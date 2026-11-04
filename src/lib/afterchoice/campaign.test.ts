import { describe, expect, it } from "vitest";
import { TRACKS } from "./engine";
import {
  TIDAL_CAMPAIGN, campaignVerdict, chooseCampaignThreat, planCampaignRound,
  playCampaignRound, projectThreat, startCampaign,
} from "./campaign";

const scenario = TIDAL_CAMPAIGN;

describe("AFTERCHOICE Phase 2 campaign engine", () => {
  it("constructs a fresh isolated three-night session", () => {
    const first = startCampaign(scenario);
    const second = startCampaign(scenario);
    expect(first.round).toBe(1);
    expect(first.pending).toEqual([]);
    expect(first.history).toEqual([]);
    expect(first.complete).toBe(false);
    first.values.a = 100;
    expect(second.values.a).toBe(scenario.initial.a);
  });

  it("enforces nightly budgets, action limits and duplicates", () => {
    const state = startCampaign(scenario);
    expect(planCampaignRound(scenario, state, []).valid).toBe(false);
    expect(planCampaignRound(scenario, state, ["repair", "repair"]).valid).toBe(false);
    expect(planCampaignRound(scenario, state, ["repair", "solar", "briefing"]).valid).toBe(false);
    expect(planCampaignRound(scenario, state, ["solar", "relief"]).valid).toBe(false);
    expect(planCampaignRound(scenario, state, ["unknown"]).valid).toBe(false);
    const valid = planCampaignRound(scenario, state, ["repair", "solar"]);
    expect(valid.valid).toBe(true);
    expect(valid.creditsUsed).toBe(5);
    expect(valid.planned).toEqual({ a: 6, b: 4, c: 5, d: 3 });
    expect(valid.queued.map((effect) => effect.dueRound)).toEqual([2, 2]);
    expect(state.values).toEqual(scenario.initial);
  });

  it("projects cascading damage only after a threshold is crossed", () => {
    const threat = scenario.threats.find((item) => item.id === "water")!;
    const bad = projectThreat({ a: 5, b: 6, c: 5, d: 4 }, threat);
    expect(bad.attacked.a).toBe(3);
    expect(bad.cascades).toBe(true);
    expect(bad.projected.b).toBe(5);
    const safe = projectThreat({ a: 6, b: 6, c: 5, d: 4 }, threat);
    expect(safe.attacked.a).toBe(4);
    expect(safe.cascades).toBe(false);
    expect(safe.projected.b).toBe(6);
  });

  it("chooses an attack from public resources and previous weaknesses", () => {
    const first = startCampaign(scenario);
    const plan = planCampaignRound(scenario, first, ["repair", "solar"]);
    const chosen = chooseCampaignThreat(scenario, plan.planned, first.history);
    expect(chosen.id).toBe("trust");
    expect(chooseCampaignThreat(scenario, plan.planned, first.history).id).toBe("trust");

    const progressed = playCampaignRound(scenario, first, ["repair", "solar"], "trust");
    const last = progressed.history[0]!;
    const previous = { ...last, failed: ["c" as const], attacker: scenario.threats[0]! };
    const next = chooseCampaignThreat(
      scenario, { a: 9, b: 9, c: 9, d: 9 }, [previous],
    );
    expect(next.id).toBe("power");
  });

  it("applies delayed effects exactly once at the next round", () => {
    const first = startCampaign(scenario);
    const second = playCampaignRound(scenario, first, ["repair", "solar"], "trust");
    expect(second.round).toBe(2);
    expect(second.pending.map((effect) => effect.dueRound)).toEqual([2, 2]);
    expect(second.history[0]!.activated).toEqual([]);
    const pending = planCampaignRound(scenario, second, ["briefing"]);
    expect(pending.afterDelayed).toEqual({ a: 7, b: 4, c: 6, d: 3 });
    expect(pending.activated.length).toBe(2);
    expect(pending.queued[0]?.dueRound).toBe(3);
    expect(second.values).toEqual({ a: 6, b: 4, c: 5, d: 3 });
    expect(first.pending).toEqual([]);
  });

  it("honours the safeguard, and still applies cascades if vulnerability remains", () => {
    const state = startCampaign(scenario);
    const weak = playCampaignRound(scenario, state, ["briefing"], "power");
    const record = weak.history[0]!;
    expect(record.attacker.id).toBe("power");
    expect(record.blocked).toBe(true);
    // Power started at 4, briefing consumed one, a -2 hit and +2 guard
    // leave power at 3: the secondary water-pump failure still occurs.
    expect(record.cascadeTriggered).toBe(true);
    expect(record.final.c).toBe(3);
    expect(record.final.a).toBe(3);
    expect(record.score).toBeGreaterThanOrEqual(0);
    expect(record.score).toBeLessThanOrEqual(100);
  });

  it("can win after three distinct connected nights without modifying history", () => {
    const start = startCampaign(scenario);
    const night1 = playCampaignRound(scenario, start, ["repair", "solar"], "trust");
    expect(night1.history[0]!.attacker.id).toBe("trust");
    const night2 = playCampaignRound(scenario, night1, ["repair", "relief"], "trust");
    expect(night2.history[1]!.attacker.id).toBe("trust");
    expect(night2.history[1]!.final).toEqual({ a: 9, b: 6, c: 5, d: 4 });
    const night3 = playCampaignRound(scenario, night2, ["food", "relief"], "power");
    expect(night3.history[2]!.attacker.id).toBe("power");
    expect(night3.complete).toBe(true);
    expect(night3.round).toBe(4);
    expect(night3.history).toHaveLength(3);
    expect(night3.history[2]!.final).toEqual({ a: 9, b: 9, c: 5, d: 5 });
    expect(TRACKS.every((track) => night3.values[track] >= scenario.targets[track])).toBe(true);
    expect(campaignVerdict(scenario, night3).won).toBe(true);
    expect(campaignVerdict(scenario, night3).stableNights).toBe(2);
    expect(campaignVerdict(scenario, night3).averageScore).toBeGreaterThan(0);
    expect(start.history).toHaveLength(0);
    expect(night1.history).toHaveLength(1);
    expect(night2.history).toHaveLength(2);
    expect(() => playCampaignRound(scenario, night3, ["repair"], "water")).toThrow();
  });

  it("rejects unknown safeguards and forged plan choices", () => {
    const start = startCampaign(scenario);
    expect(() => playCampaignRound(scenario, start, ["repair"], "bogus")).toThrow();
    expect(() => playCampaignRound(scenario, start, ["repair", "repair"], "water")).toThrow();
    expect(() => playCampaignRound(scenario, start, ["solar", "relief"], "water")).toThrow();
  });
});
