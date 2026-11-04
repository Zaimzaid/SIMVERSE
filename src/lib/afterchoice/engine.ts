/**
 * AFTERCHOICE V1: pure, deterministic strategy engine.
 * No currency, prizes, AI calls, server state or random resolution.
 * The browser client is a solo practice surface, not an authoritative PvP server.
 */
export const TRACKS = ["a", "b", "c", "d"] as const;
export type Track = (typeof TRACKS)[number];
export type TrackValues = Record<Track, number>;
export type Change = Partial<TrackValues>;

export interface Intervention {
  id: string;
  title: string;
  description: string;
  cost: number;
  change: Change;
  consequence: string;
}

export interface Threat {
  id: string;
  title: string;
  signal: string;
  change: Change;
  cascade: string;
  /** Resolves equally damaging attacks without randomness. */
  priority: number;
}

export interface Safeguard {
  id: string;
  title: string;
  description: string;
  threatId: string;
  mitigation: Change;
}

export interface Scenario {
  id: string;
  chapter: string;
  title: string;
  premise: string;
  objective: string;
  trackLabels: TrackValues extends never ? never : Record<Track, string>;
  initial: TrackValues;
  targets: TrackValues;
  credits: number;
  actionLimit: number;
  actions: Intervention[];
  threats: Threat[];
  safeguards: Safeguard[];
}

export interface PlanCheck {
  valid: boolean;
  errors: string[];
  creditsUsed: number;
  selected: Intervention[];
  values: TrackValues;
}

export interface MatchResult {
  before: TrackValues;
  afterAttack: TrackValues;
  final: TrackValues;
  attack: Threat;
  safeguard: Safeguard;
  blocked: boolean;
  passed: Track[];
  failed: Track[];
  won: boolean;
  creditsUsed: number;
  score: number;
}

export function applyChange(values: TrackValues, change: Change): TrackValues {
  return {
    a: values.a + (change.a ?? 0),
    b: values.b + (change.b ?? 0),
    c: values.c + (change.c ?? 0),
    d: values.d + (change.d ?? 0),
  };
}

export function checkPlan(scenario: Scenario, actionIds: readonly string[]): PlanCheck {
  const selected = actionIds
    .map((id) => scenario.actions.find((action) => action.id === id))
    .filter((action): action is Intervention => Boolean(action));
  const creditsUsed = selected.reduce((sum, action) => sum + action.cost, 0);
  const errors: string[] = [];
  if (!actionIds.length) errors.push("Choose at least one intervention.");
  if (actionIds.length > scenario.actionLimit) errors.push("You exceeded the action limit.");
  if (creditsUsed > scenario.credits) errors.push("You exceeded the credit budget.");
  if (new Set(actionIds).size !== actionIds.length) errors.push("An intervention can only be used once.");
  if (selected.length !== actionIds.length) errors.push("Unknown intervention.");
  const values = selected.reduce(
    (current, action) => applyChange(current, action.change),
    { ...scenario.initial },
  );
  return { valid: errors.length === 0, errors, creditsUsed, selected, values };
}

export function shortfall(values: TrackValues, targets: TrackValues): number {
  return TRACKS.reduce((sum, track) => sum + Math.max(0, targets[track] - values[track]), 0);
}

/**
 * The opponent chooses the disruption that causes the largest projected
 * total shortfall before seeing the chosen safeguard. Threat priority is a
 * documented tie-breaker; no probabilistic or opaque LLM adjudication.
 */
export function chooseThreat(scenario: Scenario, before: TrackValues): Threat {
  const ranked = [...scenario.threats].sort((left, right) => {
    const leftDamage = shortfall(applyChange(before, left.change), scenario.targets);
    const rightDamage = shortfall(applyChange(before, right.change), scenario.targets);
    return rightDamage - leftDamage || right.priority - left.priority || left.id.localeCompare(right.id);
  });
  if (!ranked[0]) throw new Error("Scenario has no threats.");
  return ranked[0];
}

export function resolveMatch(
  scenario: Scenario,
  actionIds: readonly string[],
  safeguardId: string,
): MatchResult {
  const plan = checkPlan(scenario, actionIds);
  if (!plan.valid) throw new Error(plan.errors.join(" "));
  const safeguard = scenario.safeguards.find((item) => item.id === safeguardId);
  if (!safeguard) throw new Error("Choose a valid safeguard.");

  const attack = chooseThreat(scenario, plan.values);
  const afterAttack = applyChange(plan.values, attack.change);
  const blocked = safeguard.threatId === attack.id;
  const final = blocked ? applyChange(afterAttack, safeguard.mitigation) : { ...afterAttack };
  const passed = TRACKS.filter((key) => final[key] >= scenario.targets[key]);
  const failed = TRACKS.filter((key) => final[key] < scenario.targets[key]);
  const surplus = TRACKS.reduce((sum, key) => sum + Math.max(0, final[key] - scenario.targets[key]), 0);
  // 15 per final system saved; 25 for a successful prediction; up to 10
  // for resource efficiency and up to 5 for genuine remaining resilience.
  const score = Math.min(100, passed.length * 15 + (blocked ? 25 : 0)
    + Math.min(10, (scenario.credits - plan.creditsUsed) * 2)
    + Math.min(5, surplus));

  return {
    before: { ...plan.values },
    afterAttack,
    final,
    attack,
    safeguard,
    blocked,
    passed,
    failed,
    won: failed.length === 0,
    creditsUsed: plan.creditsUsed,
    score,
  };
}
