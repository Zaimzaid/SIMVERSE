import { describe, expect, it } from "vitest";
import { createTown, advanceTownDay, playTownAction, totalMoney } from "@/lib/economy/economy-lab";
import { visualSnapshot } from "./visual-town";

describe("economy-driven 3D scene data", () => {
  it("uses actual saved-day outputs, never invents visual sale or freight events", () => {
    const start = createTown("Greenfield Republic").state;
    const first = visualSnapshot(start);
    expect(first.population).toBe(50);
    expect(first.employedAI).toBe(25);
    expect(first.humanSales).toBe(0);
    expect(first.freightFees).toBe(0);
    expect(first.roadsBuilt).toBe(0);
    const result = advanceTownDay(start);
    const after = visualSnapshot(result.state);
    expect(after.farmHarvest).toBe(result.state.summary?.harvested);
    expect(after.freightFees).toBe(result.state.summary?.freight);
    expect(after.retailSales).toBe(result.state.summary?.sold);
    expect(after.wages).toBe(result.state.summary?.wages);
    expect(after.moneySupply).toBe(first.moneySupply);
  });

  it("reflects player shop stock and finite treasury awards", () => {
    const start = createTown("Greenfield Republic").state;
    let state = playTownAction(start, { kind: "JOIN", userId: "p1", profession: "COMMERCE" }).state;
    state = playTownAction(state, { kind: "OPEN_SHOP", userId: "p1",
      businessId: "biz1", businessName: "Shop One" }).state;
    state = playTownAction(state, { kind: "INVEST", userId: "p1", businessId: "biz1", amount: 30 }).state;
    state = playTownAction(state, { kind: "BUY_STOCK", userId: "p1",
      businessId: "biz1", units: 4 }).state;
    const shown = visualSnapshot(state);
    expect(shown.playersShops).toBe(1);
    expect(shown.shopsStock).toBe(4);
    expect(shown.humanPlayers).toBe(1);
    expect(shown.treasury).toBe(3000 - 115);
    expect(shown.moneySupply).toBe(totalMoney(start));
  });
});
