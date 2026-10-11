import type { ExperienceDefinitionV1, ExperienceEventBinding } from "./schemas";
import type { ExperiencePresetType } from "./constants";

const intensity = (value: number): ExperienceEventBinding["intensity"] => ({
  camera: value, vfx: value, audio: value, reaction: value, slowMotion: Math.max(0, value - 0.25),
});
const timing = (holdMs = 180): ExperienceEventBinding["timing"] => ({
  preDelayMs: 0, holdMs, postDelayMs: 120, transitionDurationMs: 180,
  playbackEmphasis: 0.6, slowMotionPreference: 0,
});

type CameraCue = NonNullable<ExperienceEventBinding["camera"]>;
type VfxCue = NonNullable<ExperienceEventBinding["vfx"]>;
type AudioCue = NonNullable<ExperienceEventBinding["audio"]>;
type HudCue = NonNullable<ExperienceEventBinding["hud"]>;
type BindingInput = Omit<Partial<ExperienceEventBinding>, "camera" | "vfx" | "audio" | "hud"> & {
  camera?: Omit<CameraCue, "framingPreference" | "worldCameraZonePreference"> & Partial<Pick<CameraCue, "framingPreference" | "worldCameraZonePreference">>;
  vfx?: Omit<VfxCue, "assetIdentifier" | "surfaceResponseCategory"> & Partial<Pick<VfxCue, "assetIdentifier" | "surfaceResponseCategory">>;
  audio?: Omit<AudioCue, "assetIdentifier"> & Partial<Pick<AudioCue, "assetIdentifier">>;
  hud?: Omit<HudCue, "uiAssetIdentifier" | "messageTemplate"> & Partial<Pick<HudCue, "uiAssetIdentifier" | "messageTemplate">>;
};

function binding(
  identifier: string,
  eventType: ExperienceEventBinding["eventType"],
  cues: BindingInput,
): ExperienceEventBinding {
  return {
    identifier, eventType, priority: 0, intensity: intensity(0.6), timing: timing(), ...cues,
    camera: cues.camera ? { framingPreference: undefined, worldCameraZonePreference: undefined, ...cues.camera } : undefined,
    vfx: cues.vfx ? { assetIdentifier: undefined, surfaceResponseCategory: undefined, ...cues.vfx } : undefined,
    audio: cues.audio ? { assetIdentifier: undefined, ...cues.audio } : undefined,
    hud: cues.hud ? { uiAssetIdentifier: undefined, messageTemplate: undefined, ...cues.hud } : undefined,
  };
}

export const CINEMATIC_BATTLE_BINDINGS: ExperienceEventBinding[] = [
  binding("battle_intro", "battle.started", {
    animation: { actor: "INTRO" },
    camera: { mode: "INTRO_ESTABLISHING", priority: 60, durationMs: 2200, blendDurationMs: 450, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0, framingPreference: "Establish participants and environment" },
    audio: { cue: "INTRO" }, hud: { cues: ["SHOW_NAMES", "SHOW_HEALTH"] }, timing: timing(700),
  }),
  binding("attack_action", "battle.attack", {
    animation: { actor: "ATTACK_PRIMARY" },
    camera: { mode: "TRACK_ACTION", priority: 40, durationMs: 900, blendDurationMs: 160, subject: "ACTOR", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.2 },
    audio: { cue: "ATTACK" }, hud: { cues: ["SHOW_HEALTH"] }, timing: timing(260),
  }),
  binding("defend_reaction", "battle.defend", {
    animation: { actor: "DEFEND" }, camera: { mode: "REACTION_CLOSE", priority: 35, durationMs: 700, blendDurationMs: 150, subject: "ACTOR", distanceClass: "CLOSE", anglePreference: "EYE_LEVEL", shakeIntensity: 0.1 },
    vfx: { cue: "GUARD" }, audio: { cue: "DEFEND" }, hud: { cues: ["SHOW_HEALTH"] },
  }),
  binding("dodge_action", "battle.dodged", {
    animation: { target: "DODGE" }, camera: { mode: "TRACK_ACTION", priority: 50, durationMs: 650, blendDurationMs: 120, subject: "TARGET", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.15 },
    vfx: { cue: "DODGE_TRAIL" }, audio: { cue: "DODGE" }, hud: { cues: ["SHOW_EVENT_MESSAGE"] },
  }),
  binding("critical_emphasis", "battle.critical_hit", {
    animation: { target: "HIT_HEAVY" }, camera: { mode: "ATTACK_CLOSE", priority: 90, durationMs: 900, blendDurationMs: 100, subject: "TARGET", distanceClass: "CLOSE", anglePreference: "DYNAMIC", shakeIntensity: 0.75 },
    vfx: { cue: "CRITICAL" }, audio: { cue: "CRITICAL" }, hud: { cues: ["SHOW_EVENT_MESSAGE", "SHOW_DAMAGE"] },
    intensity: intensity(1), timing: { ...timing(420), playbackEmphasis: 1, slowMotionPreference: 0.65 },
  }),
  binding("damage_reaction", "battle.damage", {
    animation: { target: "HIT_LIGHT" }, camera: { mode: "REACTION_CLOSE", priority: 45, durationMs: 650, blendDurationMs: 120, subject: "TARGET", distanceClass: "CLOSE", anglePreference: "EYE_LEVEL", shakeIntensity: 0.25 },
    vfx: { cue: "IMPACT_LIGHT" }, audio: { cue: "HIT" }, hud: { cues: ["SHOW_DAMAGE", "SHOW_HEALTH"] },
  }),
  binding("heavy_damage_reaction", "battle.damage", {
    priority: 80, condition: { field: "payload.amount", operator: "GTE", value: 25 },
    animation: { target: "HIT_HEAVY" }, camera: { mode: "REACTION_CLOSE", priority: 70, durationMs: 800, blendDurationMs: 100, subject: "TARGET", distanceClass: "CLOSE", anglePreference: "LOW", shakeIntensity: 0.55 },
    vfx: { cue: "IMPACT_HEAVY" }, audio: { cue: "HIT" }, hud: { cues: ["SHOW_DAMAGE", "SHOW_HEALTH"] }, intensity: intensity(0.85),
  }),
  binding("elimination_focus", "battle.eliminated", {
    animation: { target: "DEFEATED" }, camera: { mode: "ELIMINATION_FOCUS", priority: 100, durationMs: 1800, blendDurationMs: 220, subject: "TARGET", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.3 },
    vfx: { cue: "ELIMINATION" }, audio: { cue: "ELIMINATION" }, hud: { cues: ["SHOW_RANKING", "SHOW_EVENT_MESSAGE"] }, timing: timing(650),
  }),
  binding("time_limit", "battle.timeout", {
    camera: { mode: "RESULT_OVERVIEW", priority: 80, durationMs: 1300, blendDurationMs: 300, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "HIGH", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_TIMER", "SHOW_RANKING"] },
  }),
  binding("battle_result", "battle.completed", {
    camera: { mode: "RESULT_OVERVIEW", priority: 90, durationMs: 1800, blendDurationMs: 350, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_RESULT", "SHOW_RANKING"] }, timing: timing(900),
  }),
  binding("winner_closeup", "battle.completed", {
    priority: 100, condition: { field: "payload.winnerRunParticipantId", operator: "PRESENT" },
    animation: { actor: "VICTORY" }, camera: { mode: "WINNER_CLOSEUP", priority: 100, durationMs: 2400, blendDurationMs: 300, subject: "WINNER", distanceClass: "CLOSE", anglePreference: "LOW", shakeIntensity: 0.1 },
    vfx: { cue: "VICTORY" }, audio: { cue: "VICTORY" }, hud: { cues: ["SHOW_RESULT"] }, timing: timing(1200),
  }),
];

export const CINEMATIC_RACE_BINDINGS: ExperienceEventBinding[] = [
  binding("race_intro", "race.started", {
    animation: { actor: "INTRO" },
    camera: { mode: "INTRO_ESTABLISHING", priority: 60, durationMs: 2200, blendDurationMs: 450, subject: "ALL_PARTICIPANTS", distanceClass: "EXTREME_WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0, framingPreference: "Establish the course, field and start" },
    audio: { cue: "INTRO" }, hud: { cues: ["SHOW_NAMES", "SHOW_TIMER", "SHOW_RANKING"] }, timing: timing(650),
  }),
  binding("race_progress", "race.progress", {
    camera: { mode: "OVERVIEW", priority: 15, durationMs: 700, blendDurationMs: 250, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0 },
    audio: { cue: "AMBIENT" }, hud: { cues: ["SHOW_TIMER", "SHOW_RANKING"] }, intensity: intensity(0.25), timing: timing(80),
  }),
  binding("lead_change", "race.lead_changed", {
    camera: { mode: "TRACK_ACTION", priority: 65, durationMs: 1100, blendDurationMs: 180, subject: "WINNER", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.15 },
    vfx: { cue: "DUST" }, audio: { cue: "CUSTOM" }, hud: { cues: ["SHOW_RANKING", "SHOW_EVENT_MESSAGE"] }, timing: timing(300),
  }),
  binding("race_checkpoint", "race.checkpoint", {
    camera: { mode: "FOLLOW_ACTOR", priority: 35, durationMs: 700, blendDurationMs: 140, subject: "ACTOR", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.05 },
    vfx: { cue: "SPARK" }, audio: { cue: "CUSTOM" }, hud: { cues: ["SHOW_EVENT_MESSAGE", "SHOW_RANKING"] }, timing: timing(160),
  }),
  binding("race_finish", "race.finished", {
    animation: { actor: "VICTORY" }, camera: { mode: "WINNER_CLOSEUP", priority: 85, durationMs: 1500, blendDurationMs: 220, subject: "ACTOR", distanceClass: "CLOSE", anglePreference: "LOW", shakeIntensity: 0.1 },
    vfx: { cue: "VICTORY" }, audio: { cue: "VICTORY" }, hud: { cues: ["SHOW_EVENT_MESSAGE", "SHOW_RANKING"] }, timing: timing(500),
  }),
  binding("race_timeout", "race.timeout", {
    camera: { mode: "RESULT_OVERVIEW", priority: 80, durationMs: 1300, blendDurationMs: 300, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "HIGH", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_TIMER", "SHOW_RANKING"] }, timing: timing(400),
  }),
  binding("race_result", "race.completed", {
    camera: { mode: "RESULT_OVERVIEW", priority: 95, durationMs: 2000, blendDurationMs: 350, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_RESULT", "SHOW_RANKING"] }, timing: timing(900),
  }),
  binding("race_winner", "race.completed", {
    priority: 100, condition: { field: "payload.winnerRunParticipantId", operator: "PRESENT" },
    animation: { actor: "VICTORY" }, camera: { mode: "WINNER_CLOSEUP", priority: 100, durationMs: 2400, blendDurationMs: 300, subject: "WINNER", distanceClass: "CLOSE", anglePreference: "LOW", shakeIntensity: 0.1 },
    vfx: { cue: "VICTORY" }, audio: { cue: "VICTORY" }, hud: { cues: ["SHOW_RESULT"] }, timing: timing(1200),
  }),
];

export const CINEMATIC_SURVIVAL_BINDINGS: ExperienceEventBinding[] = [
  binding("survival_intro", "survival.started", {
    animation: { actor: "INTRO" },
    camera: { mode: "INTRO_ESTABLISHING", priority: 60, durationMs: 2200, blendDurationMs: 450, subject: "ALL_PARTICIPANTS", distanceClass: "EXTREME_WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0, framingPreference: "Establish participants and environment without implying mechanics" },
    audio: { cue: "INTRO" }, hud: { cues: ["SHOW_NAMES", "SHOW_TIMER", "SHOW_RANKING"] }, timing: timing(650),
  }),
  binding("survival_status", "survival.status", {
    camera: { mode: "OVERVIEW", priority: 10, durationMs: 650, blendDurationMs: 250, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0 },
    audio: { cue: "AMBIENT" }, hud: { cues: ["SHOW_TIMER", "SHOW_RANKING"] }, intensity: intensity(0.2), timing: timing(60),
  }),
  binding("survival_resource_state", "survival.resource_changed", {
    camera: { mode: "FOLLOW_ACTOR", priority: 30, durationMs: 700, blendDurationMs: 180, subject: "ALL_PARTICIPANTS", distanceClass: "MEDIUM", anglePreference: "EYE_LEVEL", shakeIntensity: 0 },
    audio: { cue: "CUSTOM" }, hud: { cues: ["SHOW_EVENT_MESSAGE", "SHOW_RANKING"] }, intensity: intensity(0.35),
  }),
  binding("survival_hazard", "survival.hazard", {
    animation: { actor: "HIT_LIGHT" },
    camera: { mode: "TRACK_ACTION", priority: 75, durationMs: 1200, blendDurationMs: 160, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0.35 },
    vfx: { cue: "SMOKE" }, audio: { cue: "HIT" }, hud: { cues: ["SHOW_EVENT_MESSAGE", "SHOW_RANKING"] }, intensity: intensity(0.78), timing: timing(380),
  }),
  binding("survival_recovery", "survival.recovered", {
    animation: { actor: "IDLE" },
    camera: { mode: "OVERVIEW", priority: 30, durationMs: 700, blendDurationMs: 180, subject: "ALL_PARTICIPANTS", distanceClass: "MEDIUM", anglePreference: "EYE_LEVEL", shakeIntensity: 0 },
    vfx: { cue: "SPARK" }, audio: { cue: "CUSTOM" }, hud: { cues: ["SHOW_EVENT_MESSAGE"] }, intensity: intensity(0.35),
  }),
  binding("survival_leader_change", "survival.leader_changed", {
    camera: { mode: "TRACK_ACTION", priority: 65, durationMs: 1000, blendDurationMs: 180, subject: "WINNER", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.1 },
    audio: { cue: "CUSTOM" }, hud: { cues: ["SHOW_RANKING", "SHOW_EVENT_MESSAGE"] }, timing: timing(280),
  }),
  binding("survival_elimination", "survival.eliminated", {
    animation: { actor: "DEFEATED" },
    camera: { mode: "ELIMINATION_FOCUS", priority: 100, durationMs: 1800, blendDurationMs: 220, subject: "ACTOR", distanceClass: "MEDIUM", anglePreference: "DYNAMIC", shakeIntensity: 0.25 },
    vfx: { cue: "ELIMINATION" }, audio: { cue: "ELIMINATION" }, hud: { cues: ["SHOW_RANKING", "SHOW_EVENT_MESSAGE"] }, timing: timing(650),
  }),
  binding("survival_timeout", "survival.timeout", {
    camera: { mode: "RESULT_OVERVIEW", priority: 80, durationMs: 1300, blendDurationMs: 300, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "HIGH", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_TIMER", "SHOW_RANKING"] }, timing: timing(400),
  }),
  binding("survival_result", "survival.completed", {
    camera: { mode: "RESULT_OVERVIEW", priority: 95, durationMs: 2000, blendDurationMs: 350, subject: "ALL_PARTICIPANTS", distanceClass: "WIDE", anglePreference: "DYNAMIC", shakeIntensity: 0 },
    audio: { cue: "RESULT" }, hud: { cues: ["SHOW_RESULT", "SHOW_RANKING"] }, timing: timing(900),
  }),
  binding("survival_winner", "survival.completed", {
    priority: 100, condition: { field: "payload.winnerRunParticipantId", operator: "PRESENT" },
    animation: { actor: "VICTORY" }, camera: { mode: "WINNER_CLOSEUP", priority: 100, durationMs: 2400, blendDurationMs: 300, subject: "WINNER", distanceClass: "CLOSE", anglePreference: "LOW", shakeIntensity: 0.1 },
    vfx: { cue: "VICTORY" }, audio: { cue: "VICTORY" }, hud: { cues: ["SHOW_RESULT"] }, timing: timing(1200),
  }),
];

function definition(preset: ExperiencePresetType, scale: number, bindings = CINEMATIC_BATTLE_BINDINGS): ExperienceDefinitionV1 {
  return {
    schemaVersion: 1, preset, moduleCompatibility: ["battle"], simulationModeCompatibility: ["battle"],
    eventBindings: bindings.map((item) => ({
      ...structuredClone(item),
      intensity: Object.fromEntries(Object.entries(item.intensity).map(([key, value]) => [key, Math.min(1, value * scale)])) as ExperienceEventBinding["intensity"],
    })),
    assetAssociations: [], worldAssociations: [],
  };
}

function raceDefinition(preset: ExperiencePresetType, scale: number): ExperienceDefinitionV1 {
  const result = definition(preset, scale, CINEMATIC_RACE_BINDINGS);
  return { ...result, moduleCompatibility: ["race"], simulationModeCompatibility: ["race"] };
}

function survivalDefinition(preset: ExperiencePresetType, scale: number): ExperienceDefinitionV1 {
  const result = definition(preset, scale, CINEMATIC_SURVIVAL_BINDINGS);
  return { ...result, moduleCompatibility: ["survival"], simulationModeCompatibility: ["survival"] };
}

export interface ExperiencePreset {
  id: string; name: string; description: string; tags: string[]; definition: ExperienceDefinitionV1;
}

export const EXPERIENCE_PRESETS: ExperiencePreset[] = [
  { id: "simverse-cinematic-battle-v1", name: "SIMVERSE Cinematic Battle v1", description: "Reference Battle presentation with directed shots, semantic animation, effects, sound, readable HUD and result emphasis.", tags: ["battle", "cinematic", "reference"], definition: definition("CINEMATIC", 1) },
  { id: "simverse-cinematic-race-v1", name: "SIMVERSE Cinematic Race v1", description: "Original Race presentation direction with establishing coverage, leader and checkpoint focus, finish emphasis, audio, effects and ranking HUD.", tags: ["race", "cinematic", "reference"], definition: raceDefinition("CINEMATIC", 1) },
  { id: "simverse-cinematic-survival-v1", name: "SIMVERSE Cinematic Survival v1", description: "Original Survival presentation direction with environmental coverage, authoritative hazard and elimination emphasis, sound, effects and readable condition ranking.", tags: ["survival", "cinematic", "reference"], definition: survivalDefinition("CINEMATIC", 1) },
  { id: "competitive", name: "Competitive", description: "Clear state, restrained camera interruption and strong health, timer and ranking visibility.", tags: ["competitive", "clear"], definition: definition("COMPETITIVE", 0.45) },
  { id: "broadcast", name: "Broadcast", description: "Wide readable coverage, event messaging and ranking emphasis for spectators.", tags: ["broadcast", "spectator"], definition: definition("BROADCAST", 0.65) },
  { id: "minimal", name: "Minimal", description: "Simple camera direction with reduced effects and presentation overhead.", tags: ["minimal", "lightweight"], definition: definition("MINIMAL", 0.2) },
  { id: "dramatic", name: "Dramatic", description: "High emphasis reactions, close shots and deliberate transitions.", tags: ["dramatic", "emphasis"], definition: definition("DRAMATIC", 1) },
  { id: "documentary", name: "Documentary", description: "Observational coverage with environmental context and restrained spectacle.", tags: ["documentary", "observational"], definition: definition("DOCUMENTARY", 0.4) },
  { id: "cinematic", name: "Cinematic", description: "General cinematic direction derived from the SIMVERSE Battle reference.", tags: ["cinematic"], definition: definition("CINEMATIC", 0.85) },
];

export function blankExperienceDefinition(): ExperienceDefinitionV1 {
  return definition("CUSTOM", 0.5);
}
