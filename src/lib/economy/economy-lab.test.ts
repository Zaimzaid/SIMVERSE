import { describe, expect, it } from "vitest";
import {
  advanceTownDay, assertValidState, createTown, setTownTax, totalMoney,
  playTownAction, companyAccount, playerAccount,
} from "./economy-lab";

describe("SIMVERSE closed-currency Economy Lab", () => {
  it("allocates all money once and creates 50 citizens, five firms and one treasury", () => {
    const { state, opening } = createTown("Greenfield Republic");
    expect(state.citizens).toHaveLength(50);
    expect(Object.keys(state.balances)).toHaveLength(56);
    expect(totalMoney(state)).toBe(13000);
    expect(opening.reduce((n, item) => n + item.amount, 0)).toBe(totalMoney(state));
    expect(opening.every((item) => item.from === "SYSTEM_GENESIS")).toBe(true);
  });

  it("runs reproducible economic days with balanced transfers and physical goods", () => {
    let a = createTown("Greenfield").state;
    let b = createTown("Greenfield").state;
    for (let i = 0; i < 100; i++) {
      const first = advanceTownDay(a), second = advanceTownDay(b);
      expect(first).toEqual(second);
      expect(totalMoney(first.state)).toBe(13000);
      expect(first.transfers.every((x) => x.amount > 0 && x.from !== x.to)).toBe(true);
      expect(first.transfers.every((x) => x.day === i + 1)).toBe(true);
      a = first.state; b = second.state;
    }
    expect(a.day).toBe(100);
    expect(a.roadsBuilt).toBeGreaterThan(0);
    expect(a.resources.water).toBe(0);
    assertValidState(a);
  });

  it("tax policy changes the treasury share without minting money", () => {
    const start = createTown("Test Republic").state;
    const zero = advanceTownDay(setTownTax(start, 0));
    const high = advanceTownDay(setTownTax(start, 2500));
    expect(zero.state.summary?.taxes).toBe(0);
    expect(high.state.summary?.taxes).toBeGreaterThan(0);
    expect(totalMoney(zero.state)).toBe(totalMoney(high.state));
    expect(high.state.balances.treasury ?? 0).toBeGreaterThan(zero.state.balances.treasury ?? 0);
    expect(() => setTownTax(start, 2501)).toThrow();
    expect(() => setTownTax(start, -1)).toThrow();
  });

  it("does not overdraft businesses or citizens and does not allow client minting", () => {
    const state = createTown("Underfunded Town").state;
    state.balances.market = 0;
    for (const citizen of state.citizens) state.balances[citizen.id] = 0;
    const before = totalMoney(state);
    const day = advanceTownDay(state);
    expect(totalMoney(day.state)).toBe(before);
    expect(Object.values(day.state.balances).every((x) => x >= 0)).toBe(true);
    expect(day.state.summary?.sold).toBe(0);
    state.balances.farm = -1;
    expect(() => advanceTownDay(state)).toThrow();
  });
});


describe("player local economic participation", () => {
  it("joins once with profession-funded money, operates shop and preserves money supply", () => {
    let state = createTown("Player Test Republic").state;
    const start = totalMoney(state);
    let result = playTownAction(state, { kind: "JOIN", userId: "test-player", profession: "COMMERCE" });
    state = result.state;
    expect(result.transfers).toEqual([{ day: 0, from: "treasury", to: playerAccount("test-player"),
      amount: 115, kind: "PLAYER_START" }]);
    expect(state.balances[playerAccount("test-player")]).toBe(115);
    expect(() => playTownAction(state, { kind: "JOIN", userId: "test-player", profession: "AGRICULTURE" })).toThrow("Already joined");
    state = playTownAction(state, {
      kind: "OPEN_SHOP", userId: "test-player", businessId: "business-1", businessName: "My Store",
    }).state;
    expect(state.balances[playerAccount("test-player")]).toBe(85);
    expect(state.balances[companyAccount("business-1")]).toBe(30);
    state = playTownAction(state, {
      kind: "INVEST", userId: "test-player", businessId: "business-1", amount: 30,
    }).state;
    state = playTownAction(state, {
      kind: "BUY_STOCK", userId: "test-player", businessId: "business-1", units: 4,
    }).state;
    expect(state.inventory.food).toBe(4);
    expect(state.companies?.[0]?.stock).toBe(4);
    for (let i = 0; i < 3; i++) state = advanceTownDay(state).state;
    expect((state.companies?.[0]?.stock ?? 4)).toBeLessThan(4);
    expect(totalMoney(state)).toBe(start);
    const beforeDraw = state.balances[playerAccount("test-player")] ?? 0;
    state = playTownAction(state, {
      kind: "TAKE_PROFIT", userId: "test-player", businessId: "business-1", amount: 5,
    }).state;
    expect(state.balances[playerAccount("test-player")]).toBe(beforeDraw + 5);
    expect(totalMoney(state)).toBe(start);
  });

  it("guards company ownership, stock, balance, and shift duplication", () => {
    let state = createTown("Protected Economy").state;
    state = playTownAction(state, { kind: "JOIN", userId: "first", profession: "AGRICULTURE" }).state;
    state = playTownAction(state, { kind: "JOIN", userId: "second", profession: "CREATIVE" }).state;
    state = playTownAction(state, {
      kind: "OPEN_SHOP", userId: "first", businessId: "biz", businessName: "First Co",
    }).state;
    expect(() => playTownAction(state, { kind: "BUY_STOCK", userId: "second", businessId: "biz", units: 1 })).toThrow();
    expect(() => playTownAction(state, { kind: "BUY_STOCK", userId: "first", businessId: "biz", units: 8 })).toThrow();
    expect(() => playTownAction(state, { kind: "INVEST", userId: "first", businessId: "biz", amount: 999 })).toThrow();
    const moneyBefore = totalMoney(state);
    const paid = playTownAction(state, {
      kind: "WORK_SHIFT", userId: "second", businessId: "biz", employmentId: "employment-1",
    });
    expect(paid.transfers[0]?.amount).toBe(4);
    expect(paid.transfers[0]?.kind).toBe("PLAYER_WAGE");
    expect(() => playTownAction(paid.state, {
      kind: "WORK_SHIFT", userId: "second", businessId: "biz", employmentId: "employment-1",
    })).toThrow("Shift already paid");
    expect(totalMoney(paid.state)).toBe(moneyBefore);
  });
});
