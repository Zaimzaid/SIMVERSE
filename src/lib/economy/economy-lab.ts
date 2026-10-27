/**
 * SIMVERSE Economy Lab v1: deterministic, fictional, closed-money town.
 * NOT platform SVC, bank money, payable currency, or an exchange.
 * Balances are integer demo units; all post-genesis money movement is zero-sum.
 */
export type TransferKind =
  | "OPENING_ALLOCATION" | "WAGE" | "FARM_WHOLESALE" | "FOOD_WHOLESALE"
  | "FREIGHT" | "RETAIL" | "SALES_TAX" | "PUBLIC_ROAD_CONTRACT";

export interface LabTransfer {
  day: number; from: string; to: string; amount: number; kind: TransferKind;
}
export interface Citizen {
  id: string; name: string; employerId: string | null;
}
export interface LabSummary {
  day: number; harvested: number; processed: number; stocked: number;
  sold: number; wages: number; taxes: number; freight: number;
  publicSpending: number; unpaidWages: number;
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
  const keys = ["treasury", ...BUSINESS_ACCOUNTS.map((c) => c.id), ...state.citizens.map((c) => c.id)];
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
  };
  const transfers: LabTransfer[] = [];
  const summary: LabSummary = {
    day: state.day, harvested: 0, processed: 0, stocked: 0, sold: 0,
    wages: 0, taxes: 0, freight: 0, publicSpending: 0, unpaidWages: 0,
  };
  const originalSupply = totalMoney(previous);

  function move(from: string, to: string, amount: number, kind: TransferKind): boolean {
    if (!Number.isSafeInteger(amount) || amount < 0 || from === to) {
      throw new Error("Invalid economic transfer");
    }
    if (amount === 0) return true;
    if (getBalance(state, from) < amount) return false;
    const destination = getBalance(state, to);
    if (!Number.isSafeInteger(destination + amount)) throw new Error("Balance overflow");
    state.balances[from] = getBalance(state, from) - amount;
    state.balances[to] = destination + amount;
    transfers.push({ day: state.day, from, to, amount, kind });
    return true;
  }

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
    if (state.inventory.food === 0) break;
    if ((i + state.day) % 8 !== 0) continue;
    const price = 16;
    if (getBalance(state, citizen.id) < price) continue;
    const tax = Math.floor((price * state.taxBps) / 10000);
    const merchant = price - tax;
    if (!move(citizen.id, "market", merchant, "RETAIL")) continue;
    if (tax && !move(citizen.id, GOVERNMENT_ACCOUNT, tax, "SALES_TAX")) {
      throw new Error("Tax collection failed after retail payment");
    }
    state.inventory.food -= 1;
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
