import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  getMyDailyCivilizationChallenge, submitDailyCivilizationChallenge,
} from "./civilization-challenge-service";

let sequence = 0;
async function citizen() {
  const member = await registerUser({
    displayName: "Challenge Player",
    email: "civic-puzzle-" + (++sequence) + "@example.com",
    password: "Password123",
    confirmPassword: "Password123",
  });
  return member.user;
}
const tuesday = new Date("2026-11-03T16:00:00.000Z");
beforeEach(async () => resetDb());

describe("Phase 5 saved challenge results and abuse boundaries", () => {
  it("is accessible without published geography or fictional citizenship", async () => {
    const user = await citizen();
    const state = await getMyDailyCivilizationChallenge(user.id, tuesday);
    expect(state.attempt).toBeNull();
    expect(state.participantCount).toBe(0);
    expect(state.progress.completedLastSevenDays).toBe(0);
    expect(state.progress.activeStreakLastSevenDays).toBe(0);
    expect(state.vascoinGranted).toBe(false);
    expect(state.officialDistrictImpact).toBe(false);
    expect(await prisma.fictionalCountry.count()).toBe(0);
    expect(await prisma.vascoinJournal.count()).toBe(0);
  });

  it("saves one audited authoritative result per UTC day without granting tokens", async () => {
    const user = await citizen();
    const before = await getMyDailyCivilizationChallenge(user.id, tuesday);
    const ids = [before.challenge.choices[0]!.id];
    const result = await submitDailyCivilizationChallenge(user.id, { selectedIds: ids }, tuesday);
    expect(result.attempt?.selectedIds).toEqual(ids);
    expect(result.attempt?.score).toBeGreaterThan(0);
    expect(result.myRank).toBe(1);
    expect(result.participantCount).toBe(1);
    expect(result.progress.completedLastSevenDays).toBe(1);
    expect(result.progress.bestScoreLastSevenDays).toBe(result.attempt?.score);
    await expect(submitDailyCivilizationChallenge(user.id, { selectedIds: ids }, tuesday))
      .rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.civilizationChallengeAttempt.count()).toBe(1);
    expect(await prisma.auditLog.count({
      where: { actorUserId: user.id, action: "civilization.challenge_completed" },
    })).toBe(1);
    expect(await prisma.vascoinAccount.count()).toBe(0);
    expect(await prisma.vascoinJournal.count()).toBe(0);
    expect(await prisma.playerWalletEntry.count()).toBe(0);
  });

  it("isolates individual attempts but exposes only anonymized aggregate scores", async () => {
    const a = await citizen();
    const b = await citizen();
    const aState = await getMyDailyCivilizationChallenge(a.id, tuesday);
    await submitDailyCivilizationChallenge(a.id, { selectedIds: [aState.challenge.choices[0]!.id] }, tuesday);
    const viewB = await getMyDailyCivilizationChallenge(b.id, tuesday);
    expect(viewB.attempt).toBeNull();
    expect(viewB.participantCount).toBe(1);
    expect(viewB.topScores).toHaveLength(1);
    expect(viewB.progress.completedLastSevenDays).toBe(0);
    expect(viewB.progress.lastSevenDays.every((day) => day.score === null)).toBe(true);
    expect(JSON.stringify(viewB)).not.toContain(a.id);
    const bState = await submitDailyCivilizationChallenge(b.id, {
      selectedIds: [aState.challenge.choices[1]!.id],
    }, tuesday);
    expect(bState.participantCount).toBe(2);
    expect(bState.topScores).toEqual([...bState.topScores].sort((x, y) => y - x));
  });

  it("rejects forged score/currency/district, unknown or expensive selections", async () => {
    const user = await citizen();
    const puzzle = (await getMyDailyCivilizationChallenge(user.id, tuesday)).challenge;
    for (const input of [
      { selectedIds: [], score: 100 },
      { selectedIds: [puzzle.choices[0]!.id], userId: "someone-else" },
      { selectedIds: [puzzle.choices[0]!.id], grantVascoin: 1000 },
      { selectedIds: ["not-a-choice"] },
      { selectedIds: [puzzle.choices[0]!.id, puzzle.choices[0]!.id] },
      { selectedIds: [puzzle.choices[0]!.id, puzzle.choices[3]!.id, puzzle.choices[5]!.id] },
    ]) {
      await expect(submitDailyCivilizationChallenge(user.id, input, tuesday))
        .rejects.toBeInstanceOf(ValidationError);
    }
    await expect(submitDailyCivilizationChallenge(user.id, {
      selectedIds: [puzzle.choices[0]!.id], dayKey: "2026-11-02",
    }, tuesday)).rejects.toBeInstanceOf(ConflictError);
    expect(await prisma.civilizationChallengeAttempt.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "civilization.challenge_completed" } })).toBe(0);
  });

  it("allows one separate result on the next UTC day", async () => {
    const user = await citizen();
    const d1 = await getMyDailyCivilizationChallenge(user.id, tuesday);
    await submitDailyCivilizationChallenge(user.id, {
      selectedIds: [d1.challenge.choices[0]!.id],
    }, tuesday);
    const tomorrow = new Date("2026-11-04T00:00:00.000Z");
    const d2 = await getMyDailyCivilizationChallenge(user.id, tomorrow);
    expect(d2.attempt).toBeNull();
    await submitDailyCivilizationChallenge(user.id, {
      selectedIds: [d2.challenge.choices[0]!.id],
    }, tomorrow);
    expect(await prisma.civilizationChallengeAttempt.count()).toBe(2);
  });
});
