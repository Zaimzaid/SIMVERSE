import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import {
  dailyChallenge, evaluateDailyChallenge, utcChallengeDay, summarizeChallengeWeek,
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
  it("tracks only the seven-day UTC window and handles a not-yet-played today", () => {
    const inputs = [
      { dayKey: "2026-11-01", score: 70 },
      { dayKey: "2026-11-02", score: 81 },
      { dayKey: "2026-11-03", score: 93 },
      { dayKey: "2026-10-27", score: 100 },
    ];
    const today = summarizeChallengeWeek(inputs, new Date("2026-11-03T10:00:00Z"));
    expect(today.completedLastSevenDays).toBe(3);
    expect(today.bestScoreLastSevenDays).toBe(93);
    expect(today.activeStreakLastSevenDays).toBe(3);
    expect(today.lastSevenDays).toHaveLength(7);
    expect(today.lastSevenDays[0]!.dayKey).toBe("2026-10-28");
    const tomorrow = summarizeChallengeWeek(inputs, new Date("2026-11-04T10:00:00Z"));
    expect(tomorrow.activeStreakLastSevenDays).toBe(3);
    const missed = summarizeChallengeWeek(inputs, new Date("2026-11-05T10:00:00Z"));
    expect(missed.activeStreakLastSevenDays).toBe(0);
    expect(summarizeChallengeWeek([], new Date("2026-11-03T10:00:00Z")).bestScoreLastSevenDays).toBeNull();
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
