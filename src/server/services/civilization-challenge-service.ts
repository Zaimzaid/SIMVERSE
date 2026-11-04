import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ConflictError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import {
  dailyChallenge, evaluateDailyChallenge, summarizeChallengeWeek,
  utcChallengeDay, type DailyChallengeOverview,
} from "@/lib/civilization/daily-challenge";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

const submissionSchema = z.object({
  selectedIds: z.array(z.string().min(1).max(64)).min(1).max(3),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export async function getMyDailyCivilizationChallenge(
  userId: string,
  now: Date = new Date(),
): Promise<DailyChallengeOverview> {
  const challenge = dailyChallenge(now);
  const dayKey = challenge.dayKey;
  const earliest = utcChallengeDay(new Date(Date.parse(dayKey + "T00:00:00.000Z") - 6 * 86400000));
  const [attempt, top, participantCount, history] = await Promise.all([
    prisma.civilizationChallengeAttempt.findUnique({
      where: { userId_dayKey: { userId, dayKey } },
    }),
    prisma.civilizationChallengeAttempt.findMany({
      where: { dayKey },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      select: { score: true },
      take: 10,
    }),
    prisma.civilizationChallengeAttempt.count({ where: { dayKey } }),
    prisma.civilizationChallengeAttempt.findMany({
      where: { userId, dayKey: { gte: earliest, lte: dayKey } },
      select: { dayKey: true, score: true },
      orderBy: { dayKey: "asc" },
      take: 7,
    }),
  ]);
  const myRank = attempt
    ? 1 + await prisma.civilizationChallengeAttempt.count({
      where: { dayKey, score: { gt: attempt.score } },
    })
    : null;
  return {
    challenge,
    attempt: attempt ? {
      selectedIds: JSON.parse(attempt.selectedIdsJson) as string[],
      score: attempt.score,
      budgetUsed: attempt.budgetUsed,
      createdAt: attempt.createdAt.toISOString(),
    } : null,
    participantCount,
    // Only anonymous score values are exposed; never disclose private user IDs.
    topScores: top.map((entry) => entry.score),
    progress: summarizeChallengeWeek(history, now),
    myRank,
    vascoinGranted: false,
    officialDistrictImpact: false,
  };
}

export async function submitDailyCivilizationChallenge(
  userId: string, input: unknown, now: Date = new Date(),
): Promise<DailyChallengeOverview> {
  const { selectedIds, dayKey } = parseOrThrow(submissionSchema, input);
  const challenge = dailyChallenge(now);
  if (dayKey && dayKey !== challenge.dayKey) {
    throw new ConflictError("The daily challenge changed. Refresh this page before submitting.");
  }
  const result = evaluateDailyChallenge(challenge, selectedIds);
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.civilizationChallengeAttempt.create({
        data: {
          userId,
          dayKey: challenge.dayKey,
          scenarioId: challenge.scenarioId,
          selectedIdsJson: JSON.stringify(result.selectedIds),
          budgetUsed: result.budgetUsed,
          score: result.score,
        },
      });
      await recordAudit({
        action: "civilization.challenge_completed",
        actorUserId: userId,
        entityType: "CivilizationChallengeAttempt",
        entityId: created.id,
        metadata: {
          dayKey: challenge.dayKey, scenarioId: challenge.scenarioId,
          score: result.score, vascoinGranted: false, officialDistrictImpact: false,
        },
      }, tx);
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("You already completed today's challenge. Come back tomorrow (UTC).");
    }
    throw error;
  }
  return getMyDailyCivilizationChallenge(userId, now);
}
