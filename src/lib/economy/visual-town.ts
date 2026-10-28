import {
  BUSINESS_ACCOUNTS, type EconomyLabState,
} from "@/lib/economy/economy-lab";

/** Compact, truthful mapping from persisted economy figures to a decorative 3D scene.
 * Only the advance-day backend simulates production and financial transfers.
 * Renderer animation never changes game money or creates business transactions.
 */
export interface TownVisualSnapshot {
  day: number;
  townName: string;
  population: number;
  employedAI: number;
  humanPlayers: number;
  playersShops: number;
  shopsStock: number;
  moneySupply: number;
  treasury: number;
  farmWater: number;
  farmSeeds: number;
  farmHarvest: number;
  marketFood: number;
  retailSales: number;
  humanSales: number;
  freightFees: number;
  wages: number;
  taxes: number;
  roadsBuilt: number;
  businesses: Array<{ id: string; label: string; balance: number }>;
}
export function visualSnapshot(state: EconomyLabState): TownVisualSnapshot {
  const summary = state.summary;
  return {
    day: state.day,
    townName: state.name,
    population: state.citizens.length,
    employedAI: state.citizens.filter(citizen => citizen.employerId !== null).length,
    humanPlayers: state.participants?.length ?? 0,
    playersShops: state.companies?.length ?? 0,
    shopsStock: (state.companies ?? []).reduce((total, company) => total + company.stock, 0),
    moneySupply: Object.values(state.balances).reduce((total, value) => total + value, 0),
    treasury: state.balances.treasury ?? 0,
    farmWater: state.resources.water,
    farmSeeds: state.resources.seeds,
    farmHarvest: summary?.harvested ?? 0,
    marketFood: state.inventory.food,
    retailSales: summary?.sold ?? 0,
    humanSales: summary?.playerSales ?? 0,
    freightFees: summary?.freight ?? 0,
    wages: summary?.wages ?? 0,
    taxes: summary?.taxes ?? 0,
    roadsBuilt: state.roadsBuilt,
    businesses: BUSINESS_ACCOUNTS.map(business => ({
      id: business.id, label: business.name, balance: state.balances[business.id] ?? 0,
    })),
  };
}
