import { describe, expect, it } from "vitest";
import { AFTERCHOICE_SCENARIOS } from "./scenarios";
import { applyChange, checkPlan, chooseThreat, resolveMatch, TRACKS } from "./engine";

const first = AFTERCHOICE_SCENARIOS[0]!;

describe("AFTERCHOICE strategy engine", () => {
  it("calculates interventions without changing the scenario", () => {
    const original = { ...first.initial };
    const after = applyChange(original, { a: 2, d: -1 });
    expect(after).toEqual({ a: 5, b: 4, c: 3, d: 2 });
    expect(original).toEqual(first.initial);
  });

  it("enforces credits, action limits and no repeated interventions", () => {
    expect(checkPlan(first, []).valid).toBe(false);
    expect(checkPlan(first, ["pipes", "pipes"]).valid).toBe(false);
    expect(checkPlan(first, ["solar", "pipes", "gardens", "ration"]).valid).toBe(false);
    expect(checkPlan(first, ["solar", "pipes", "imports"]).valid).toBe(true);
    expect(checkPlan(first, ["fake-action"]).valid).toBe(false);
  });

  it("uses an inspectable deterministic attack policy", () => {
    const plan = checkPlan(first, ["pipes", "solar", "gardens"]);
    expect(plan.values).toEqual({ a: 5, b: 6, c: 5, d: 4 });
    expect(chooseThreat(first, plan.values).id).toBe("contamination");
    expect(chooseThreat(first, plan.values).id).toBe("contamination");
  });

  it("correct safeguard cancels the targeted loss", () => {
    const actions = ["pipes", "solar", "gardens"];
    const win = resolveMatch(first, actions, "filters");
    const miss = resolveMatch(first, actions, "batteries");
    expect(win.blocked).toBe(true);
    expect(win.won).toBe(true);
    expect(win.final.a).toBe(5);
    expect(miss.blocked).toBe(false);
    expect(miss.won).toBe(false);
    expect(miss.final.a).toBe(3);
    expect(win.score).toBeGreaterThan(miss.score);
  });

  it("rejects invalid commitment and unknown safeguard", () => {
    expect(() => resolveMatch(first, ["pipes", "pipes"], "filters")).toThrow();
    expect(() => resolveMatch(first, ["pipes"], "unknown")).toThrow();
  });

  it("each hand-authored scenario has at least one survivable legal plan", () => {
    for (const scenario of AFTERCHOICE_SCENARIOS) {
      let hasWinningPlan = false;
      const ids = scenario.actions.map((action) => action.id);
      for (let mask = 1; mask < (1 << ids.length); mask++) {
        const chosen = ids.filter((_, index) => (mask & (1 << index)) !== 0);
        const plan = checkPlan(scenario, chosen);
        if (!plan.valid) continue;
        for (const safeguard of scenario.safeguards) {
          const result = resolveMatch(scenario, chosen, safeguard.id);
          if (result.won && TRACKS.every((key) => result.final[key] >= scenario.targets[key])) {
            hasWinningPlan = true;
          }
        }
      }
      expect(hasWinningPlan, scenario.title).toBe(true);
    }
  });
});
