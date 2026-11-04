/**
 * AFTERCHOICE Phase 2: three-round campaign engine.
 *
 * All effects are deterministic. Threat selection inspects public state and
 * history, never the player's secret safeguard. The practice client has no
 * authoritative matchmaking, currency, ranked scores or network dependency.
 */
import {
  TRACKS, applyChange, shortfall,
  type Change, type Intervention, type Safeguard,
  type Track, type TrackValues,
} from "./engine";

export interface CampaignAction extends Intervention {
  delayed?: { change: Change; description: string };
}
export interface CascadeRule {
  track: Track;
  below: number;
  change: Change;
  explanation: string;
}
export interface CampaignThreat {
  id: string;
  title: string;
  signal: string;
  target: Track;
  change: Change;
  cascade: CascadeRule;
  priority: number;
}
export interface CampaignScenario {
  id: string;
  title: string;
  premise: string;
  rounds: number;
  credits: number;
  actionLimit: number;
  initial: TrackValues;
  targets: TrackValues;
  trackLabels: Record<Track, string>;
  actions: CampaignAction[];
  threats: CampaignThreat[];
  safeguards: Safeguard[];
}
export interface PendingEffect {
  actionId: string;
  dueRound: number;
  change: Change;
  description: string;
}
export interface CampaignRound {
  round: number;
  actionIds: string[];
  safeguardId: string;
  starting: TrackValues;
  afterDelayed: TrackValues;
  planned: TrackValues;
  afterAttack: TrackValues;
  final: TrackValues;
  activated: PendingEffect[];
  queued: PendingEffect[];
  attacker: CampaignThreat;
  blocked: boolean;
  cascadeTriggered: boolean;
  failed: Track[];
  creditsUsed: number;
  score: number;
}
export interface CampaignState {
  round: number;
  values: TrackValues;
  pending: PendingEffect[];
  history: CampaignRound[];
  complete: boolean;
}
export interface CampaignPlan {
  valid: boolean;
  errors: string[];
  selected: CampaignAction[];
  creditsUsed: number;
  afterDelayed: TrackValues;
  planned: TrackValues;
  activated: PendingEffect[];
  queued: PendingEffect[];
}

export const TIDAL_CAMPAIGN: CampaignScenario = {
  id: "tidal-city-v2",
  title: "Tidal City: The Three Nights",
  premise: "A storm has exposed critical weaknesses in a coastal city. You have three nights to stabilise it. Every night the challenger attacks, and every decision leaves consequences for tomorrow.",
  rounds: 3,
  credits: 5,
  actionLimit: 2,
  initial: { a: 4, b: 4, c: 4, d: 4 },
  targets: { a: 5, b: 5, c: 5, d: 4 },
  trackLabels: { a: "Water", b: "Food", c: "Power", d: "Trust" },
  actions: [
    { id: "repair", title: "Repair river mains", description: "Rebuild failing water infrastructure.",
      cost: 2, change: { a: 2, c: -1 }, consequence: "Repair crews divert electricity.",
      delayed: { change: { a: 1 }, description: "The repaired water mains provide another unit of water." } },
    { id: "solar", title: "Deploy rooftop solar", description: "Install temporary neighborhood power.",
      cost: 3, change: { c: 2, d: -1 }, consequence: "The emergency installation causes disruption.",
      delayed: { change: { c: 1 }, description: "The solar network reaches full capacity." } },
    { id: "food", title: "Organize food cooperatives", description: "Local crews share emergency supplies.",
      cost: 2, change: { b: 2, a: -1 }, consequence: "Food logistics consume fresh water.",
      delayed: { change: { b: 1 }, description: "Local food cooperatives deliver a second shipment." } },
    { id: "briefing", title: "Public emergency briefing", description: "Coordinate people with verified information.",
      cost: 1, change: { d: 2, c: -1 }, consequence: "Communication equipment uses backup power.",
      delayed: { change: { d: 1 }, description: "Trusted messengers continue reassuring residents." } },
    { id: "ration", title: "Restrict water consumption", description: "Conserve emergency water stocks.",
      cost: 1, change: { a: 2, d: -2 }, consequence: "Unpopular restrictions cause frustration.",
      delayed: { change: { d: -1 }, description: "Water restrictions increase resentment the next day." } },
    { id: "generator", title: "Run reserve generators", description: "Switch on emergency power plants.",
      cost: 2, change: { c: 2, b: -1 }, consequence: "Generators consume food refrigeration capacity.",
      delayed: { change: { c: -1 }, description: "Fuel shortages reduce tomorrow's power." } },
    { id: "relief", title: "Distribute relief packages", description: "Deliver food and morale support.",
      cost: 3, change: { b: 2, d: 1 }, consequence: "Temporary supplies cannot last indefinitely.",
      delayed: { change: { b: -1 }, description: "The one-off relief stock runs low." } },
  ],
  threats: [
    { id: "water", title: "Junction contamination", signal: "Water testing stations report unusual readings.",
      target: "a", change: { a: -2 }, priority: 3,
      cascade: { track: "a", below: 4, change: { b: -1 },
        explanation: "Water falls below 4; food preparation loses one additional unit." } },
    { id: "power", title: "Transformer blackout", signal: "An unstable transformer remains exposed.",
      target: "c", change: { c: -2 }, priority: 2,
      cascade: { track: "c", below: 4, change: { a: -1 },
        explanation: "Power falls below 4; water pumps lose one additional unit." } },
    { id: "trust", title: "False emergency bulletin", signal: "Unverified messages spread across the city.",
      target: "d", change: { d: -2 }, priority: 1,
      cascade: { track: "d", below: 3, change: { b: -1 },
        explanation: "Trust falls below 3; panic buying damages food access." } },
  ],
  safeguards: [
    { id: "water", title: "Emergency filtration", description: "Reserve mobile filtration to counter contamination.",
      threatId: "water", mitigation: { a: 2 } },
    { id: "power", title: "Battery isolation", description: "Prepare batteries to stabilise the transformer network.",
      threatId: "power", mitigation: { c: 2 } },
    { id: "trust", title: "Verified communications", description: "Recruit trusted witnesses to reject fake bulletins.",
      threatId: "trust", mitigation: { d: 2 } },
  ],
};

export function startCampaign(scenario: CampaignScenario = TIDAL_CAMPAIGN): CampaignState {
  return { round: 1, values: { ...scenario.initial }, pending: [], history: [], complete: false };
}

export function planCampaignRound(
  scenario: CampaignScenario, state: CampaignState, ids: readonly string[],
): CampaignPlan {
  const errors: string[] = [];
  if (state.complete || state.round < 1 || state.round > scenario.rounds)
    errors.push("This campaign has already finished.");
  const selected = ids.map((id) => scenario.actions.find((action) => action.id === id))
    .filter((action): action is CampaignAction => Boolean(action));
  const creditsUsed = selected.reduce((sum, action) => sum + action.cost, 0);
  if (!ids.length) errors.push("Choose at least one intervention.");
  if (ids.length > scenario.actionLimit) errors.push("Too many interventions.");
  if (new Set(ids).size !== ids.length) errors.push("An intervention cannot be selected twice in a round.");
  if (selected.length !== ids.length) errors.push("Unknown intervention.");
  if (creditsUsed > scenario.credits) errors.push("The plan exceeds the nightly budget.");

  // Effects queued in earlier rounds activate before this round's new actions.
  const activated = state.pending.filter((item) => item.dueRound === state.round);
  const afterDelayed = activated.reduce((value, item) => applyChange(value, item.change),
    { ...state.values });
  const planned = selected.reduce((value, action) => applyChange(value, action.change), afterDelayed);
  const queued: PendingEffect[] = selected.flatMap((action) => action.delayed
    ? [{
      actionId: action.id, dueRound: state.round + 1,
      change: { ...action.delayed.change }, description: action.delayed.description,
    }] : []);
  return { valid: errors.length === 0, errors, selected, creditsUsed, afterDelayed, planned, activated, queued };
}

/** Calculate the outcome an undefended disruption would cause. */
export function projectThreat(before: TrackValues, threat: CampaignThreat): {
  attacked: TrackValues; projected: TrackValues; cascades: boolean;
} {
  const attacked = applyChange(before, threat.change);
  const cascades = attacked[threat.cascade.track] < threat.cascade.below;
  return { attacked, projected: cascades ? applyChange(attacked, threat.cascade.change) : attacked, cascades };
}

/**
 * Adaptive but fair challenger: choose projected total shortage (primary and
 * cascading damage), preferring threats that exploit a weakness remaining from
 * the previous night, and discouraging repeated attacks if tied.
 *
 * The safeguard is NOT an argument and never affects attack selection.
 */
export function chooseCampaignThreat(
  scenario: CampaignScenario, planned: TrackValues, history: readonly CampaignRound[],
): CampaignThreat {
  const previous = history[history.length - 1];
  const ranked = [...scenario.threats].sort((left, right) => {
    const rating = (threat: CampaignThreat) => {
      const projected = projectThreat(planned, threat).projected;
      return shortfall(projected, scenario.targets) * 10
        + (previous?.failed.includes(threat.target) ? 3 : 0)
        - (previous?.attacker.id === threat.id ? 2 : 0);
    };
    return rating(right) - rating(left) || right.priority - left.priority
      || left.id.localeCompare(right.id);
  });
  if (!ranked[0]) throw new Error("Campaign requires at least one threat.");
  return ranked[0];
}

export function playCampaignRound(
  scenario: CampaignScenario, state: CampaignState,
  actionIds: readonly string[], safeguardId: string,
): CampaignState {
  const plan = planCampaignRound(scenario, state, actionIds);
  if (!plan.valid) throw new Error(plan.errors.join(" "));
  const safeguard = scenario.safeguards.find((item) => item.id === safeguardId);
  if (!safeguard) throw new Error("Select a valid safeguard.");
  const attacker = chooseCampaignThreat(scenario, plan.planned, state.history);
  const afterAttack = applyChange(plan.planned, attacker.change);
  const blocked = attacker.id === safeguard.threatId;
  const protectedValues = blocked ? applyChange(afterAttack, safeguard.mitigation) : afterAttack;
  const cascadeTriggered = protectedValues[attacker.cascade.track] < attacker.cascade.below;
  const final = cascadeTriggered ? applyChange(protectedValues, attacker.cascade.change) : protectedValues;
  const failed = TRACKS.filter((track) => final[track] < scenario.targets[track]);
  const surplus = TRACKS.reduce((sum, track) => sum + Math.max(0, final[track] - scenario.targets[track]), 0);
  const score = Math.min(100, (4 - failed.length) * 15 + (blocked ? 20 : 0)
    + (scenario.credits - plan.creditsUsed) * 2 + Math.min(10, surplus));
  const record: CampaignRound = {
    round: state.round, actionIds: [...actionIds], safeguardId,
    starting: { ...state.values }, afterDelayed: { ...plan.afterDelayed },
    planned: { ...plan.planned }, afterAttack, final, activated: plan.activated,
    queued: plan.queued, attacker, blocked, cascadeTriggered, failed,
    creditsUsed: plan.creditsUsed, score,
  };
  const round = state.round + 1;
  return {
    round,
    values: { ...final },
    pending: [...state.pending.filter((effect) => effect.dueRound > state.round), ...plan.queued],
    history: [...state.history, record],
    complete: round > scenario.rounds,
  };
}

export function campaignVerdict(scenario: CampaignScenario, state: CampaignState) {
  const latest = state.history[state.history.length - 1];
  return {
    complete: state.complete,
    won: state.complete && !!latest && latest.failed.length === 0,
    averageScore: state.history.length
      ? Math.round(state.history.reduce((sum, record) => sum + record.score, 0) / state.history.length)
      : 0,
    stableNights: state.history.filter((record) => record.failed.length === 0).length,
  };
}
