import { describe, expect, it } from "vitest";
import {
  advanceTownDay, assertValidState, createTown, setTownTax, totalMoney,
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
