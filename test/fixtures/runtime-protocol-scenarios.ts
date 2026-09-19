import {
  CORE_ENGINE_VERSION,
  DEFAULT_FIXED_STEP_MS,
  INPUT_SNAPSHOT_VERSION,
  RESULT_VERSION,
} from "@/lib/engine/constants";
import { initializeEngine, stepEngine } from "@/lib/engine/engine";
import {
  inputSnapshotSchema,
  type InputSnapshotV1,
  type ParticipantSnapshotV1,
} from "@/lib/engine/schemas";
import { RNG_ALGORITHM_VERSION } from "@/lib/engine/rng";
import { battleModule } from "@/lib/modules/battle/battle-module";
import {
  BATTLE_MODULE_ID,
  BATTLE_MODULE_VERSION,
} from "@/lib/modules/battle/config";
import {
  buildSimulationRuntimePackageV1,
  type RuntimePackageSourceV1,
  type SimulationRuntimePackageV1,
} from "@/lib/runtime-protocol/v1";
import type { VisualArchetype } from "@/lib/visuals/profile";

export const RUNTIME_FIXTURE_ORIGIN_CHECKPOINT = "a432b7b";

interface ScenarioParticipant {
  id: string;
  entityId: string;
  name: string;
  category: string;
  archetype?: VisualArchetype;
  stats: Partial<Record<"strength" | "defense" | "speed" | "intelligence" | "luck", number>>;
}

interface ScenarioDefinition {
  filename: string;
  scenario: string;
  runId: string;
  simulationId: string;
  simulationName: string;
  seed: string;
  format: "duel" | "free_for_all";
  maxTicks: number;
  allowTies: boolean;
  startedAt: string;
  participants: ScenarioParticipant[];
}

const definitions: readonly ScenarioDefinition[] = [
  {
    filename: "duel-knockout.json",
    scenario: "Duel — Knockout",
    runId: "run-fixture-duel-knockout",
    simulationId: "simulation-fixture-duel-knockout",
    simulationName: "Lion vs Tiger — Knockout",
    seed: "SV-KNOCK001",
    format: "duel",
    maxTicks: 120,
    allowTies: false,
    startedAt: "2026-09-19T12:00:00.000Z",
    participants: [
      {
        id: "participant-lion",
        entityId: "entity-lion",
        name: "Lion",
        category: "animal",
        archetype: "QUADRUPED",
        stats: { strength: 100, defense: 80, speed: 75, intelligence: 60, luck: 55 },
      },
      {
        id: "participant-tiger",
        entityId: "entity-tiger",
        name: "Tiger",
        category: "animal",
        archetype: "QUADRUPED",
        stats: { strength: 25, defense: 25, speed: 35, intelligence: 30, luck: 25 },
      },
    ],
  },
  {
    filename: "duel-time-limit.json",
    scenario: "Duel — Time Limit",
    runId: "run-fixture-duel-time-limit",
    simulationId: "simulation-fixture-duel-time-limit",
    simulationName: "Falcon vs Hawk — Time Limit",
    seed: "SV-TIME0001",
    format: "duel",
    maxTicks: 1,
    allowTies: false,
    startedAt: "2026-09-19T13:00:00.000Z",
    participants: [
      {
        id: "participant-falcon",
        entityId: "entity-falcon",
        name: "Falcon",
        category: "animal",
        stats: { strength: 50, defense: 50, speed: 50, intelligence: 50, luck: 50 },
      },
      {
        id: "participant-hawk",
        entityId: "entity-hawk",
        name: "Hawk",
        category: "animal",
        stats: { strength: 50, defense: 50, speed: 50, intelligence: 50, luck: 50 },
      },
    ],
  },
  {
    filename: "four-player-free-for-all.json",
    scenario: "Four-player Free-for-All",
    runId: "run-fixture-four-player-ffa",
    simulationId: "simulation-fixture-four-player-ffa",
    simulationName: "Four Archetypes — Free-for-All",
    seed: "SV-FFA00001",
    format: "free_for_all",
    maxTicks: 120,
    allowTies: false,
    startedAt: "2026-09-19T14:00:00.000Z",
    participants: [
      {
        id: "participant-robot",
        entityId: "entity-robot",
        name: "Atlas Robot",
        category: "robot",
        archetype: "ROBOT",
        stats: { strength: 95, defense: 85, speed: 60, intelligence: 80, luck: 45 },
      },
      {
        id: "participant-car",
        entityId: "entity-car",
        name: "Velocity Car",
        category: "vehicle",
        archetype: "VEHICLE_GROUND",
        stats: { strength: 60, defense: 55, speed: 95, intelligence: 35, luck: 40 },
      },
      {
        id: "participant-mage",
        entityId: "entity-mage",
        name: "Ember Mage",
        category: "fantasy_character",
        archetype: "HUMANOID",
        stats: { strength: 45, defense: 40, speed: 55, intelligence: 95, luck: 65 },
      },
      {
        id: "participant-orb",
        entityId: "entity-orb",
        name: "Quantum Orb",
        category: "object",
        archetype: "ABSTRACT",
        stats: { strength: 35, defense: 65, speed: 45, intelligence: 70, luck: 80 },
      },
    ],
  },
];

function attributes(stats: ScenarioParticipant["stats"]): ParticipantSnapshotV1["attributes"] {
  return Object.entries(stats).map(([key, value]) => ({
    definitionId: `definition-${key}`,
    key,
    name: key[0]!.toUpperCase() + key.slice(1),
    description: null,
    dataType: "NUMBER",
    unit: null,
    minimum: 0,
    maximum: 100,
    options: null,
    defaultValue: "50",
    isBuiltIn: true,
    value: String(value),
  }));
}

function participantSnapshot(
  participant: ScenarioParticipant,
  position: number,
): ParticipantSnapshotV1 {
  return {
    runParticipantId: participant.id,
    sourceEntityId: participant.entityId,
    position,
    role: position === 0 ? "primary" : null,
    overrides: null,
    name: participant.name,
    shortName: null,
    description: null,
    category: participant.category,
    status: "ACTIVE",
    imageUrl: `https://assets.simverse.example/portraits/${participant.entityId}.webp`,
    primaryColor: position % 2 === 0 ? "#D8A33F" : "#4F7DD9",
    secondaryColor: position % 2 === 0 ? "#4A2F1B" : "#182B4D",
    metadata: null,
    ...(participant.archetype ? {
      visualProfileVersion: 1 as const,
      visualProfile: {
        version: 1 as const,
        profileRevision: 1,
        sourceType: "MODEL_3D" as const,
        portraitUrl: `https://assets.simverse.example/portraits/${participant.entityId}.webp`,
        modelUrl: `/models/${participant.entityId}.glb`,
        archetype: participant.archetype,
        scale: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        animationProfile: {
          IDLE: "Idle",
          RUN: "Run",
          ATTACK_PRIMARY: "Attack",
          HIT_LIGHT: "Hit",
          DEFEATED: "Defeated",
          VICTORY: "Victory",
        },
        enabled: true,
      },
    } : {}),
    tags: [],
    attributes: attributes(participant.stats),
  };
}

function inputFor(definition: ScenarioDefinition): InputSnapshotV1 {
  return inputSnapshotSchema.parse({
    version: INPUT_SNAPSHOT_VERSION,
    simulationId: definition.simulationId,
    simulationName: definition.simulationName,
    mode: "battle",
    configVersion: 1,
    configuration: {
      version: 1,
      general: {
        speed: "normal",
        roundLimit: definition.maxTicks,
        randomEvents: true,
        allowTies: definition.allowTies,
        difficulty: "normal",
      },
      mode: { format: definition.format },
    },
    presentation: {
      displayTitle: definition.simulationName,
      themeColor: "#22D3EE",
      showLabels: true,
      showLeaderboard: true,
    },
    resolvedSeed: definition.seed,
    participants: definition.participants.map(participantSnapshot),
  });
}

function execute(definition: ScenarioDefinition): {
  package: SimulationRuntimePackageV1;
  source: RuntimePackageSourceV1;
} {
  const input = inputFor(definition);
  let state = initializeEngine(battleModule, input, DEFAULT_FIXED_STEP_MS);
  let lastActionSequence = 0;
  let lastEventSequence = 0;
  const events = [];
  let result = null;

  while (!result && state.tick < 160) {
    const outcome = stepEngine(
      battleModule,
      input,
      state,
      DEFAULT_FIXED_STEP_MS,
      lastActionSequence,
      lastEventSequence,
    );
    state = outcome.state;
    lastActionSequence = outcome.lastActionSequence;
    lastEventSequence = outcome.lastEventSequence;
    events.push(...outcome.events.map((event) => ({
      ...event,
      id: `${definition.runId}-event-${event.sequence}`,
    })));
    result = outcome.result;
  }
  if (!result) throw new Error(`Fixture scenario '${definition.scenario}' did not complete.`);

  const startedAt = new Date(definition.startedAt);
  const createdAt = new Date(startedAt.valueOf() - 60_000);
  const completedAt = new Date(startedAt.valueOf() + state.elapsedSimulationMs);
  const source: RuntimePackageSourceV1 = {
    run: {
      id: definition.runId,
      simulationId: definition.simulationId,
      status: "COMPLETED",
      mode: "battle",
      resolvedSeed: definition.seed,
      coreEngineVersion: CORE_ENGINE_VERSION,
      moduleId: BATTLE_MODULE_ID,
      moduleVersion: BATTLE_MODULE_VERSION,
      rngAlgorithmVersion: RNG_ALGORITHM_VERSION,
      inputSnapshotVersion: INPUT_SNAPSHOT_VERSION,
      inputSnapshot: input,
      fixedStepMs: DEFAULT_FIXED_STEP_MS,
      currentTick: state.tick,
      elapsedSimulationMs: state.elapsedSimulationMs,
      resultVersion: RESULT_VERSION,
      result,
      createdAt,
      startedAt,
      completedAt,
      participants: input.participants,
    },
    events,
  };
  return { package: buildSimulationRuntimePackageV1(source), source };
}

export interface GeneratedRuntimeFixture {
  filename: string;
  scenario: string;
  seed: string;
  package: SimulationRuntimePackageV1;
  source: RuntimePackageSourceV1;
}

export function generateRuntimeProtocolFixtures(): GeneratedRuntimeFixture[] {
  return definitions.map((definition) => {
    const generated = execute(definition);
    return {
      filename: definition.filename,
      scenario: definition.scenario,
      seed: definition.seed,
      ...generated,
    };
  });
}
