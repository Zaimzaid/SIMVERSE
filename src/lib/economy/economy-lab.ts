/**
 * SIMVERSE Economy Lab v1: deterministic, fictional, closed-money town.
 * NOT platform SVC, bank money, payable currency, or an exchange.
 * Balances are integer demo units; all post-genesis money movement is zero-sum.
 */
export type TransferKind =
  | "OPENING_ALLOCATION" | "WAGE" | "FARM_WHOLESALE" | "FOOD_WHOLESALE"
  | "FREIGHT" | "RETAIL" | "SALES_TAX" | "PUBLIC_ROAD_CONTRACT"
  | "PLAYER_START" | "BUSINESS_CAPITAL" | "PLAYER_WHOLESALE"
  | "PLAYER_SALE" | "OWNER_DRAW" | "PLAYER_WAGE";

export interface LabTransfer {
  day: number; from: string; to: string; amount: number; kind: TransferKind;
}
export interface Citizen {
  id: string; name: string; employerId: string | null;
}
export interface LabSummary {
  day: number; harvested: number; processed: number; stocked: number;
  sold: number; wages: number; taxes: number; freight: number;
  publicSpending: number; unpaidWages: number; playerSales?: number;
}
export interface LabPlayer { userId: string; profession: string; accountId: string; joinedDay: number }
export interface LabCompany {
  businessId: string; ownerUserId: string; accountId: string; name: string;
  stock: number; shifts: Record<string, number>;
}
export interface EconomyLabState {
  version: 1;
  name: string;
  currency: "GFC";
  day: number;
  taxBps: number;
  balances: Record<string, number>;
  citizens: Citizen[];
  inventory: { vegetables: number; flour: number; food: number };
  resources: { water: number; seeds: number };
  roadsBuilt: number;
  summary: LabSummary | null;
  participants?: LabPlayer[];
  companies?: LabCompany[];
}
export const ECONOMY_LAB_NOTICE =
  "Private fictional economic sandbox. GFC cannot be purchased, withdrawn, " +
  "exchanged, transferred to player SVC wallets, or redeemed for money.";
export const BUSINESS_ACCOUNTS = [
  { id: "farm", name: "Greenfield Farm", activity: "Agriculture" },
  { id: "mill", name: "Greenfield Foods", activity: "Food processing" },
  { id: "market", name: "Town Grocery", activity: "Retail" },
  { id: "truck", name: "Town Logistics", activity: "Transport" },
  { id: "build", name: "Town Construction", activity: "Construction" },
] as const;
export const GOVERNMENT_ACCOUNT = "treasury";
const INITIAL_CITIZEN_CASH = 100;
const INITIAL_BUSINESS_CASH = 1000;
const INITIAL_TREASURY_CASH = 3000;
const CITIZEN_NAMES = [
  "Amina", "David", "Chidi", "Ada", "Zara", "Tunde", "Ife", "Musa", "Bola", "Grace",
  "Kemi", "Sani", "Ngozi", "Mary", "James", "Fola", "Emeka", "Ruth", "Kunle", "Zainab",
];

export function totalMoney(state: EconomyLabState): number {
  return Object.values(state.balances).reduce((a, b) => a + b, 0);
}
export function getBalance(state: EconomyLabState, id: string): number {
  const balance = state.balances[id];
  if (balance === undefined) throw new Error("Missing economic account");
  return balance;
}
export function createTown(name: string): { state: EconomyLabState; opening: LabTransfer[] } {
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 80) throw new Error("Invalid town name");
  const balances: Record<string, number> = { [GOVERNMENT_ACCOUNT]: INITIAL_TREASURY_CASH };
  for (const company of BUSINESS_ACCOUNTS) balances[company.id] = INITIAL_BUSINESS_CASH;
  const citizens: Citizen[] = Array.from({ length: 50 }, (_, i) => {
    const id = "citizen-" + String(i + 1).padStart(2, "0");
    balances[id] = INITIAL_CITIZEN_CASH;
    return {
      id,
      name: CITIZEN_NAMES[i % CITIZEN_NAMES.length] + " " + (i + 1),
      employerId: i < 25 ? BUSINESS_ACCOUNTS[Math.floor(i / 5)]!.id : null,
    };
  });
  const state: EconomyLabState = {
    version: 1, name: clean, currency: "GFC", day: 0, taxBps: 1000,
    balances, citizens, inventory: { vegetables: 10, flour: 2, food: 8 },
    resources: { water: 600, seeds: 600 }, roadsBuilt: 0, summary: null,
    participants: [], companies: [],
  };
  const opening = Object.entries(balances).map(([to, amount]) => ({
    day: 0, from: "SYSTEM_GENESIS", to, amount,
    kind: "OPENING_ALLOCATION" as const,
  }));
  assertValidState(state);
  return { state, opening };
}
export function assertValidState(state: EconomyLabState): void {
  if (state.version !== 1 || state.currency !== "GFC" ||
      !Number.isSafeInteger(state.day) || state.day < 0 || state.day > 3650 ||
      !Number.isInteger(state.taxBps) || state.taxBps < 0 || state.taxBps > 2500 ||
      state.citizens.length !== 50) throw new Error("Invalid economy state");
  const participants = state.participants ?? [], companies = state.companies ?? [];
  if (participants.length > 12 || companies.length > 12 ||
      new Set(participants.map(p => p.userId)).size !== participants.length ||
      new Set(companies.map(c => c.businessId)).size !== companies.length ||
      companies.some(c => !participants.some(p => p.userId === c.ownerUserId) ||
        !Number.isSafeInteger(c.stock) || c.stock < 0 || c.stock > 200 ||
        Object.values(c.shifts).some(day => !Number.isInteger(day) || day < 0 || day > state.day)) ||
      participants.some(p => p.accountId !== playerAccount(p.userId)) ||
      companies.some(c => c.accountId !== companyAccount(c.businessId))) {
    throw new Error("Invalid human player participation state");
  }
  const keys = ["treasury", ...BUSINESS_ACCOUNTS.map((c) => c.id),
    ...state.citizens.map((c) => c.id),
    ...participants.map(p => p.accountId), ...companies.map(c => c.accountId)];
  if (new Set(keys).size !== keys.length ||
      Object.keys(state.balances).length !== keys.length ||
      keys.some((id) => !Number.isSafeInteger(state.balances[id]) || (state.balances[id] ?? -1) < 0)) {
    throw new Error("Economic ledger has invalid balances");
  }
  const stocks = [...Object.values(state.inventory), ...Object.values(state.resources), state.roadsBuilt];
  if (stocks.some((x) => !Number.isSafeInteger(x) || x < 0)) throw new Error("Invalid real resource inventory");
}
export function setTownTax(state: EconomyLabState, taxBps: number): EconomyLabState {
  assertValidState(state);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 2500) {
    throw new Error("Tax rate must be between 0 and 25 percent");
  }
  return { ...state, taxBps };
}
export function advanceTownDay(previous: EconomyLabState): {
  state: EconomyLabState; transfers: LabTransfer[];
} {
  assertValidState(previous);
  if (previous.day >= 3650) throw new Error("Demo reached its 10-year limit");
  const state: EconomyLabState = {
    ...previous, day: previous.day + 1, balances: { ...previous.balances },
    inventory: { ...previous.inventory }, resources: { ...previous.resources },
    participants: [...(previous.participants ?? [])],
    companies: (previous.companies ?? []).map(c => ({ ...c, shifts: { ...c.shifts } })),
  };
  const transfers: LabTransfer[] = [];
  const summary: LabSummary = {
    day: state.day, harvested: 0, processed: 0, stocked: 0, sold: 0,
    wages: 0, taxes: 0, freight: 0, publicSpending: 0, unpaidWages: 0, playerSales: 0,
  };
  const originalSupply = totalMoney(previous);

  const move = (from: string, to: string, amount: number, kind: TransferKind) =>
    transfer(state, transfers, from, to, amount, kind);

  // Physical input stocks are finite; output cannot appear without seeds/water.
  if (state.resources.water >= 8 && state.resources.seeds >= 8) {
    state.resources.water -= 8;
    state.resources.seeds -= 8;
    state.inventory.vegetables += 8;
    summary.harvested = 8;
  }
  // Wholesale trade transfers both inventory and already-existing currency.
  const vegetables = Math.min(4, state.inventory.vegetables);
  if (vegetables > 0 && move("mill", "farm", vegetables * 6, "FARM_WHOLESALE")) {
    state.inventory.vegetables -= vegetables;
    state.inventory.flour += vegetables;
    summary.processed = vegetables;
    if (move("mill", "truck", 2, "FREIGHT")) summary.freight += 2;
  }
  const flour = Math.min(4, state.inventory.flour);
  if (flour > 0 && move("market", "mill", flour * 9, "FOOD_WHOLESALE")) {
    state.inventory.flour -= flour;
    state.inventory.food += flour;
    summary.stocked = flour;
    if (move("market", "truck", 2, "FREIGHT")) summary.freight += 2;
  }
  // Payroll is an actual transfer; insufficient funds produce unpaid wages.
  for (const citizen of state.citizens) {
    if (citizen.employerId) {
      if (move(citizen.employerId, citizen.id, 2, "WAGE")) summary.wages += 2;
      else summary.unpaidWages += 2;
    }
  }
  // Rotating purchase decisions: simple deterministic agents, no external LLM.
  for (let i = 0; i < state.citizens.length; i++) {
    const citizen = state.citizens[i]!;
    if (state.inventory.food === 0 && !state.companies?.some(c => c.stock > 0)) break;
    if ((i + state.day) % 8 !== 0) continue;
    const price = 16;
    if (getBalance(state, citizen.id) < price) continue;
    const tax = Math.floor((price * state.taxBps) / 10000);
    const merchant = price - tax;
    const available = (state.companies ?? []).filter(c => c.stock > 0);
    const preferred = i % 2 === 0 ? available[(i + state.day) % available.length] : undefined;
    const vendor = preferred ?? (state.inventory.food > 0 ? undefined : available[0]);
    const seller = vendor?.accountId ?? "market";
    if (!vendor && state.inventory.food === 0) continue;
    if (!move(citizen.id, seller, merchant, vendor ? "PLAYER_SALE" : "RETAIL")) continue;
    if (tax && !move(citizen.id, GOVERNMENT_ACCOUNT, tax, "SALES_TAX")) {
      throw new Error("Tax collection failed after retail payment");
    }
    if (vendor) { vendor.stock--; summary.playerSales = (summary.playerSales ?? 0) + 1; }
    else state.inventory.food -= 1;
    summary.sold++;
    summary.taxes += tax;
  }
  // Public projects create a visible infrastructure counter with a real cost.
  if (state.day % 3 === 0 && move(GOVERNMENT_ACCOUNT, "build", 50, "PUBLIC_ROAD_CONTRACT")) {
    state.roadsBuilt++;
    summary.publicSpending += 50;
  }
  state.summary = summary;
  assertValidState(state);
  if (totalMoney(state) !== originalSupply) throw new Error("Monetary conservation invariant failed");
  return { state, transfers };
}


/** These accounts never overlap with original citizens or the five AI firms. */
export function playerAccount(userId: string) { return "player:" + userId; }
export function companyAccount(businessId: string) { return "company:" + businessId; }

function transfer(
  state: EconomyLabState, transfers: LabTransfer[],
  from: string, to: string, amount: number, kind: TransferKind,
): boolean {
  if (!Number.isSafeInteger(amount) || amount < 0 || from === to) throw new Error("Invalid transfer");
  if (amount === 0) return true;
  if (getBalance(state, from) < amount) return false;
  const destination = getBalance(state, to);
  if (!Number.isSafeInteger(destination + amount)) throw new Error("Balance overflow");
  state.balances[from] = getBalance(state, from) - amount;
  state.balances[to] = destination + amount;
  transfers.push({ day: state.day, from, to, amount, kind });
  return true;
}
const STARTER_GFC: Record<string, number> = {
  AGRICULTURE: 120, ENGINEERING: 110, HEALTH: 95, EDUCATION: 90,
  COMMERCE: 115, CREATIVE: 85, TRANSPORT: 100, CIVIC: 80,
};
export const PLAYER_STOCK_COST = 10;
export const PLAYER_STOCK_LIMIT = 8;
export const PLAYER_SHIFT_WAGE = 4;
export const PLAYER_STARTER_POLICY = { ...STARTER_GFC };

export type PlayerTownAction =
  | { kind: "JOIN"; userId: string; profession: string }
  | { kind: "OPEN_SHOP"; userId: string; businessId: string; businessName: string }
  | { kind: "INVEST"; userId: string; businessId: string; amount: number }
  | { kind: "BUY_STOCK"; userId: string; businessId: string; units: number }
  | { kind: "TAKE_PROFIT"; userId: string; businessId: string; amount: number }
  | { kind: "WORK_SHIFT"; userId: string; businessId: string; employmentId: string };

export function playTownAction(previous: EconomyLabState, action: PlayerTownAction) {
  assertValidState(previous);
  const state: EconomyLabState = {
    ...previous, balances: { ...previous.balances },
    participants: [...(previous.participants ?? [])],
    companies: (previous.companies ?? []).map(c => ({ ...c, shifts: { ...c.shifts } })),
  };
  const transfers: LabTransfer[] = [];
  const originalSupply = totalMoney(previous);
  const account = playerAccount(action.userId);
  if (action.kind === "JOIN") {
    if (state.participants!.some(p => p.userId === action.userId)) throw new Error("Already joined");
    if (state.participants!.length >= 12) throw new Error("Town is full");
    const grant = STARTER_GFC[action.profession];
    state.balances[account] = 0;
    if (!grant || !transfer(state, transfers, GOVERNMENT_ACCOUNT, account, grant, "PLAYER_START")) {
      throw new Error("No available starter budget or profession");
    }
  } else {
    if (!state.participants!.some(p => p.userId === action.userId)) throw new Error("Join the town first");
    if (action.kind === "WORK_SHIFT") {
      const company = state.companies!.find(c => c.businessId === action.businessId);
      if (!company) throw new Error("Business is not operating in this town");
      if (company.shifts[action.employmentId] === state.day) throw new Error("Shift already paid today");
      if (!transfer(state, transfers, company.accountId, account, PLAYER_SHIFT_WAGE, "PLAYER_WAGE")) {
        throw new Error("Company cannot pay a shift");
      }
      company.shifts[action.employmentId] = state.day;
    } else {
      const company = action.kind === "OPEN_SHOP" ? undefined :
        state.companies!.find(c => c.businessId === action.businessId && c.ownerUserId === action.userId);
      if (action.kind === "OPEN_SHOP") {
        if (state.companies!.some(c => c.ownerUserId === action.userId || c.businessId === action.businessId)) {
          throw new Error("Only one operating company is allowed per player per town");
        }
        if (state.companies!.length >= 12) throw new Error("Town business limit reached");
        state.balances[companyAccount(action.businessId)] = 0;
        if (!transfer(state, transfers, account, companyAccount(action.businessId), 30, "BUSINESS_CAPITAL")) {
          throw new Error("Need 30 GFC opening capital");
        }
        state.companies!.push({
          businessId: action.businessId, name: action.businessName,
          ownerUserId: action.userId, accountId: companyAccount(action.businessId),
          stock: 0, shifts: {},
        });
      } else {
        if (!company) throw new Error("This business is not yours");
        if (action.kind === "INVEST") {
          if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 1000 ||
              !transfer(state, transfers, account, company.accountId, action.amount, "BUSINESS_CAPITAL")) {
            throw new Error("Insufficient GFC for company investment");
          }
        } else if (action.kind === "BUY_STOCK") {
          const { units } = action;
          if (!Number.isInteger(units) || units < 1 || units > PLAYER_STOCK_LIMIT ||
              company.stock + units > 200 || state.inventory.food < units ||
              !transfer(state, transfers, company.accountId, "market", units * PLAYER_STOCK_COST, "PLAYER_WHOLESALE")) {
            throw new Error("Insufficient stock or operating cash");
          }
          company.stock += units;
          state.inventory.food -= units;
        } else if (action.kind === "TAKE_PROFIT") {
          if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 1000 ||
              !transfer(state, transfers, company.accountId, account, action.amount, "OWNER_DRAW")) {
            throw new Error("Insufficient company funds");
          }
        }
      }
    }
  }
  if (action.kind === "JOIN") {
    const grant = STARTER_GFC[action.profession]!;
    state.participants!.push({ userId: action.userId, profession: action.profession,
      accountId: account, joinedDay: state.day });
    // Account is allocated from the existing treasury, never minted.
  }
  assertValidState(state);
  if (totalMoney(state) !== originalSupply) throw new Error("Money conservation failed");
  return { state, transfers };
}
