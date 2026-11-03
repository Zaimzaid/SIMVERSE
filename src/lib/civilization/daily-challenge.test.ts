import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  dailyChallenge, evaluateDailyChallenge, utcChallengeDay,
} from "./daily-challenge";

describe("K3 non-3D daily civic planning puzzle", () => {
  const day = new Date("2026-11-03T22:00:00Z");
  it("uses a consistent UTC challenge, rotating independently of client input", () => {
    const first = dailyChallenge(day);
    expect(first).toEqual(dailyChallenge(new Date("2026-11-03T01:00:00Z")));
    expect(first.dayKey).toBe("2026-11-03");
    expect(utcChallengeDay(new Date("2026-11-04T00:00:00Z"))).toBe("2026-11-04");
    expect(first.choices.length).toBeGreaterThan(5);
    expect(first.budget).toBe(12);
    expect(first.notice).toContain("do not change official districts");
    expect(dailyChallenge(new Date("2026-11-04T12:00:00Z")).scenarioId).not.toBe(first.scenarioId);
  });
  it("scores a legal selection against the actual best legal subset", () => {
    const puzzle = dailyChallenge(day);
    const candidate = evaluateDailyChallenge(puzzle, [puzzle.choices[0]!.id]);
    expect(candidate.score).toBeGreaterThan(0);
    expect(candidate.score).toBeLessThanOrEqual(100);
    expect(candidate.budgetUsed).toBe(puzzle.choices[0]!.cost);
    const combinations = [];
    for (let mask = 1; mask < (1 << puzzle.choices.length); mask++) {
      const ids = puzzle.choices.filter((_, i) => (mask & (1 << i)) !== 0).map((choice) => choice.id);
      if (ids.length > puzzle.maxSelections) continue;
      try { combinations.push(evaluateDailyChallenge(puzzle, ids)); } catch { /* over-budget */ }
    }
    expect(Math.max(...combinations.map((entry) => entry.score))).toBe(100);
  });
  it("rejects empty, repeated, invented and over-budget selections", () => {
    const puzzle = dailyChallenge(day);
    for (const ids of [
      [], ["bogus"], [puzzle.choices[0]!.id, puzzle.choices[0]!.id],
      puzzle.choices.slice(0, 4).map((choice) => choice.id),
      [puzzle.choices[0]!.id, puzzle.choices[3]!.id, puzzle.choices[5]!.id],
    ]) {
      expect(() => evaluateDailyChallenge(puzzle, ids)).toThrow(ValidationError);
    }
    expect(() => utcChallengeDay(new Date("bad"))).toThrow(ValidationError);
  });
});
