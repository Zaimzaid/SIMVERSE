import { ValidationError } from "@/lib/errors";

/**
 * K3/Phase 5: deterministic, self-contained, non-3D planning puzzle.
 * These numbers are fictional game tokens, NOT real district land or budgets.
 * A score is never a currency issuance or a development authorization.
 */
export type ChallengeChoice = {
  id: string;
  title: string;
  category: string;
  cost: number;
  impact: number;
  description: string;
};

export type DailyChallenge = {
  dayKey: string;
  scenarioId: string;
  title: string;
  story: string;
  budget: number;
  maxSelections: number;
  choices: ChallengeChoice[];
  notice: string;
};

/** Scores are private; this view contains only the requesting user's past results. */
export type ChallengeProgress = {
  lastSevenDays: { dayKey: string; score: number | null }[];
  completedLastSevenDays: number;
  bestScoreLastSevenDays: number | null;
  activeStreakLastSevenDays: number;
};

export function summarizeChallengeWeek(
  entries: ReadonlyArray<{ dayKey: string; score: number }>,
  now: Date,
): ChallengeProgress {
  const day = utcChallengeDay(now);
  const midnight = Date.parse(day + "T00:00:00.000Z");
  const ownScores = new Map(entries.map((entry) => [entry.dayKey, entry.score]));
  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const dayKey = new Date(midnight - (6 - i) * 86400000).toISOString().slice(0, 10);
    return { dayKey, score: ownScores.get(dayKey) ?? null };
  });
  const completed = lastSevenDays.filter((entry) => entry.score !== null);
  // A streak is still active before today's submission if yesterday was played.
  const latestIndex = lastSevenDays[6]!.score !== null ? 6 : 5;
  let streak = 0;
  for (let index = latestIndex; index >= 0; index--) {
    if (lastSevenDays[index]!.score === null) break;
    streak++;
  }
  return {
    lastSevenDays,
    completedLastSevenDays: completed.length,
    bestScoreLastSevenDays: completed.length
      ? Math.max(...completed.map((entry) => entry.score!))
      : null,
    activeStreakLastSevenDays: streak,
  };
}

export type DailyChallengeOverview = {
  challenge: DailyChallenge;
  attempt: null | {
    selectedIds: string[];
    score: number;
    budgetUsed: number;
    createdAt: string;
  };
  participantCount: number;
  topScores: number[];
  progress: ChallengeProgress;
  myRank: number | null;
  vascoinGranted: false;
  officialDistrictImpact: false;
};

type Scenario = {
  id: string;
  title: string;
  story: string;
  budget: number;
  maxSelections: number;
  choices: ChallengeChoice[];
};

const scenarios: Scenario[] = [
  {
    id: "neighborhood-wellbeing-v1",
    title: "The first neighborhood",
    story: "Your fictional community has 12 planning tokens. Choose up to three improvements to maximize community impact.",
    budget: 12,
    maxSelections: 3,
    choices: [
      { id: "water", title: "Public water points", category: "Essentials", cost: 5, impact: 12, description: "Give more people convenient access to drinking water." },
      { id: "lights", title: "Solar street lights", category: "Safety", cost: 4, impact: 9, description: "Light shared paths after sunset." },
      { id: "garden", title: "Community gardens", category: "Environment", cost: 3, impact: 7, description: "Provide shared green space and growing beds." },
      { id: "reading", title: "Reading room", category: "Education", cost: 4, impact: 10, description: "Open a space for learning and study." },
      { id: "cleanup", title: "Cleanup teams", category: "Environment", cost: 2, impact: 5, description: "Improve cleanliness across common areas." },
      { id: "sports", title: "Community sports", category: "Recreation", cost: 5, impact: 11, description: "Create a place for recreational events." },
      { id: "notice", title: "Public notice board", category: "Services", cost: 2, impact: 4, description: "Share useful information in one place." },
    ],
  },
  {
    id: "healthy-community-v1",
    title: "A healthy community",
    story: "Balance health, learning and safety in a fictional district. Spend at most 12 tokens on three improvements.",
    budget: 12,
    maxSelections: 3,
    choices: [
      { id: "clinic", title: "First aid center", category: "Health", cost: 6, impact: 15, description: "Provide a local point for urgent basic care." },
      { id: "sanitation", title: "Sanitation stations", category: "Health", cost: 4, impact: 9, description: "Add shared washing and hygiene facilities." },
      { id: "crossings", title: "Safe crossings", category: "Safety", cost: 3, impact: 8, description: "Help pedestrians cross busy paths safely." },
      { id: "library", title: "Learning hub", category: "Education", cost: 5, impact: 12, description: "Offer study spaces and shared learning activities." },
      { id: "trees", title: "Shade trees", category: "Environment", cost: 3, impact: 7, description: "Make public walking routes more comfortable." },
      { id: "play", title: "Play corner", category: "Recreation", cost: 4, impact: 8, description: "Create accessible recreational space." },
      { id: "signs", title: "Information signs", category: "Services", cost: 2, impact: 5, description: "Make shared facilities easier to find." },
    ],
  },
  {
    id: "community-energy-v1",
    title: "Make the community resilient",
    story: "Pick a balanced set of upgrades for a fictional settlement. Your budget is 12 tokens and your limit is three upgrades.",
    budget: 12,
    maxSelections: 3,
    choices: [
      { id: "solar", title: "Shared solar kiosk", category: "Energy", cost: 6, impact: 15, description: "Provide basic shared charging points." },
      { id: "drain", title: "Drainage repairs", category: "Safety", cost: 5, impact: 12, description: "Reduce everyday flooding around paths." },
      { id: "compost", title: "Compost station", category: "Environment", cost: 3, impact: 7, description: "Turn organic scraps into useful material." },
      { id: "skills", title: "Skills workshop", category: "Education", cost: 5, impact: 13, description: "Give citizens a shared place to learn hands-on skills." },
      { id: "benches", title: "Public benches", category: "Recreation", cost: 2, impact: 5, description: "Add resting spots around shared places." },
      { id: "recycling", title: "Recycling points", category: "Environment", cost: 4, impact: 9, description: "Help residents sort reusable materials." },
      { id: "alerts", title: "Community alerts", category: "Services", cost: 2, impact: 6, description: "Share important community notices." },
    ],
  },
];

export function utcChallengeDay(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new ValidationError("Invalid challenge date.");
  return now.toISOString().slice(0, 10);
}

export function dailyChallenge(now: Date = new Date()): DailyChallenge {
  const dayKey = utcChallengeDay(now);
  const ordinal = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const scenario = scenarios[ordinal % scenarios.length]!;
  return {
    dayKey,
    scenarioId: scenario.id,
    title: scenario.title,
    story: scenario.story,
    budget: scenario.budget,
    maxSelections: scenario.maxSelections,
    choices: scenario.choices.map((choice) => ({ ...choice })),
    notice: "Practice puzzle only. Tokens, impact and scores do not change official districts, land, citizenship or Vascoin.",
  };
}

function impactOf(choices: ChallengeChoice[]): number {
  const base = choices.reduce((sum, choice) => sum + choice.impact, 0);
  // Variety is worth two additional fictional impact points per extra category.
  return base + Math.max(0, new Set(choices.map((choice) => choice.category)).size - 1) * 2;
}

export function evaluateDailyChallenge(challenge: DailyChallenge, selectedIds: string[]) {
  if (!Array.isArray(selectedIds) || selectedIds.length < 1 ||
      selectedIds.length > challenge.maxSelections ||
      new Set(selectedIds).size !== selectedIds.length) {
    throw new ValidationError("Choose between one and three different improvements.");
  }
  const selected = selectedIds.map((id) => challenge.choices.find((choice) => choice.id === id));
  if (selected.some((item) => !item)) {
    throw new ValidationError("One or more improvements do not belong to today's challenge.");
  }
  const chosen = selected as ChallengeChoice[];
  const budgetUsed = chosen.reduce((sum, choice) => sum + choice.cost, 0);
  if (budgetUsed > challenge.budget) {
    throw new ValidationError("The selection exceeds today's fictional token budget.");
  }

  let maximumImpact = 0;
  for (let mask = 1; mask < (1 << challenge.choices.length); mask++) {
    const subset = challenge.choices.filter((_, i) => (mask & (1 << i)) !== 0);
    if (subset.length > challenge.maxSelections ||
        subset.reduce((sum, choice) => sum + choice.cost, 0) > challenge.budget) continue;
    maximumImpact = Math.max(maximumImpact, impactOf(subset));
  }
  const rawImpact = impactOf(chosen);
  return {
    selectedIds: [...selectedIds],
    budgetUsed,
    rawImpact,
    maximumImpact,
    score: Math.round(100 * rawImpact / maximumImpact),
  };
}
