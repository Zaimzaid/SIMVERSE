import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROTOCOL_VERSION_V1,
  RuntimeProtocolError,
  buildSimulationRuntimePackageV1,
  parseSimulationRuntimePackageV1,
  serializeSimulationRuntimePackageV1,
  type RuntimePackageSourceV1,
  type SimulationRuntimePackageV1,
} from "@/lib/runtime-protocol/v1";
import { generateRuntimeProtocolFixtures } from "./fixtures/runtime-protocol-scenarios";

const fixtures = generateRuntimeProtocolFixtures();
const knockout = fixtures.find((fixture) => fixture.filename === "duel-knockout.json")!;
const timeout = fixtures.find((fixture) => fixture.filename === "duel-time-limit.json")!;

function packageClone(fixture = knockout): SimulationRuntimePackageV1 {
  return structuredClone(fixture.package);
}

function sourceClone(fixture = knockout): RuntimePackageSourceV1 {
  return structuredClone(fixture.source);
}

function expectBuildCode(source: RuntimePackageSourceV1, code: RuntimeProtocolError["code"]): void {
  try {
    buildSimulationRuntimePackageV1(source);
    throw new Error("Expected Runtime Protocol build to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeProtocolError);
    expect(error).toMatchObject({ code });
  }
}

describe("SimulationRuntimePackageV1", () => {
  it("validates a complete engine-neutral Battle package", () => {
    const parsed = parseSimulationRuntimePackageV1(knockout.package);
    expect(parsed.packageType).toBe("SimulationRuntimePackageV1");
    expect(parsed.protocolVersion).toBe(RUNTIME_PROTOCOL_VERSION_V1);
    expect(parsed.module).toEqual({ id: "battle", version: "battle-v1" });
    expect(parsed.world).toBeNull();
  });

  it("rejects an unsupported protocol version", () => {
    const invalid = packageClone() as unknown as { protocolVersion: string };
    invalid.protocolVersion = "2.0.0";
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/protocolVersion/);
  });

  it("preserves valid immutable participant identity and position", () => {
    expect(knockout.package.participants).toMatchObject([
      { runParticipantId: "participant-lion", sourceEntityId: "entity-lion", position: 0,
        identity: { displayName: "Lion", category: "animal" } },
      { runParticipantId: "participant-tiger", sourceEntityId: "entity-tiger", position: 1,
        identity: { displayName: "Tiger", category: "animal" } },
    ]);
  });

  it("rejects an event actor outside the immutable participant set", () => {
    const invalid = packageClone();
    const event = invalid.events.find((candidate) => candidate.actorRunParticipantId !== null)!;
    event.actorRunParticipantId = "participant-not-in-run";
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/actorRunParticipantId/);
  });

  it("rejects an event target outside the immutable participant set", () => {
    const invalid = packageClone();
    const event = invalid.events.find((candidate) => candidate.targetRunParticipantId !== null)!;
    event.targetRunParticipantId = "participant-not-in-run";
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/targetRunParticipantId/);
  });

  it("preserves contiguous persisted event sequence and simulated time", () => {
    expect(knockout.package.events.every((event, index) => event.sequence === index + 1)).toBe(true);
    expect(knockout.package.events.every((event, index, all) => index === 0 ||
      (event.tick >= all[index - 1]!.tick && event.simulatedTimeMs >= all[index - 1]!.simulatedTimeMs))).toBe(true);
  });

  it("rejects reordered or duplicate event history instead of repairing it", () => {
    const invalid = packageClone();
    [invalid.events[1], invalid.events[2]] = [invalid.events[2]!, invalid.events[1]!];
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/sequence/);
  });

  it("validates the registered payload structure for every persisted event", () => {
    const invalid = packageClone() as unknown as { events: Array<{ type: string; payload: unknown }> };
    const attack = invalid.events.find((event) => event.type === "battle.attack")!;
    attack.payload = { untrusted: true };
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/events/);
  });

  it("preserves the authoritative BattleResultV1 without recomputing it", () => {
    const source = sourceClone();
    const built = buildSimulationRuntimePackageV1(source);
    expect(built.result.payload).toEqual(source.run.result?.modulePayload);
    expect(built.result.payload).toEqual(knockout.package.result.payload);
  });

  it("preserves Core, RNG, snapshot, result and seed provenance versions", () => {
    expect(knockout.package.versions).toEqual({
      coreEngine: "core-v0.1",
      rngAlgorithm: "mulberry32-v1",
      inputSnapshot: 1,
      resultEnvelope: 1,
    });
    expect(knockout.package.seedProvenance).toEqual({
      resolvedSeed: "SV-KNOCK001",
      source: "RUN_INPUT_SNAPSHOT",
    });
  });

  it("preserves the visual snapshot, archetype, transforms and semantic mappings", () => {
    expect(knockout.package.participants[0]?.visual).toMatchObject({
      snapshotVersion: 1,
      profileRevision: 1,
      sourceType: "MODEL_3D",
      archetype: "QUADRUPED",
      modelReference: "/models/entity-lion.glb",
      transform: {
        scale: 1,
        rotationDegrees: { x: 0, y: 0, z: 0 },
        offsetMeters: { x: 0, y: 0, z: 0 },
      },
      animationMapping: { ATTACK_PRIMARY: "Attack", DEFEATED: "Defeated" },
    });
  });

  it("represents legacy snapshots without visual metadata explicitly as null", () => {
    expect(timeout.package.participants.every((participant) => participant.visual === null)).toBe(true);
  });

  it("rejects incomplete Runs and completed Runs missing an authoritative result", () => {
    const incomplete = sourceClone();
    incomplete.run.status = "RUNNING";
    expectBuildCode(incomplete, "RUN_NOT_COMPLETED");

    const missing = sourceClone();
    missing.run.result = null;
    expectBuildCode(missing, "MISSING_RESULT");
  });

  it("rejects unsupported modules and module versions with distinct eligibility errors", () => {
    const module = sourceClone();
    module.run.mode = "race";
    module.run.moduleId = "race";
    expectBuildCode(module, "UNSUPPORTED_MODULE");

    const version = sourceClone();
    version.run.moduleVersion = "battle-v2";
    expectBuildCode(version, "UNSUPPORTED_VERSION");
  });

  it("rejects unsupported Core, RNG, snapshot and result versions", () => {
    for (const field of ["coreEngineVersion", "rngAlgorithmVersion", "inputSnapshotVersion", "resultVersion"] as const) {
      const source = sourceClone();
      Object.assign(source.run, { [field]: field.endsWith("Version") && typeof source.run[field] === "number" ? 2 : "future-v2" });
      expectBuildCode(source, "UNSUPPORTED_VERSION");
    }
  });

  it("omits unrelated snapshot metadata, attributes, secrets and workspace data", () => {
    const source = sourceClone();
    const sensitive = { session: "session-secret", billing: "billing-secret", apiToken: "api-secret" };
    source.run.participants[0]!.metadata = sensitive;
    source.run.inputSnapshot.participants[0]!.metadata = sensitive;
    source.run.participants[0]!.description = "private-audit-detail";
    source.run.inputSnapshot.participants[0]!.description = "private-audit-detail";
    const serialized = serializeSimulationRuntimePackageV1(buildSimulationRuntimePackageV1(source));
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("billing-secret");
    expect(serialized).not.toContain("api-secret");
    expect(serialized).not.toContain("private-audit-detail");
    expect(serialized).not.toContain("workspaceId");
    expect(serialized).not.toContain("attributes");
  });

  it("rejects credential-bearing asset references", () => {
    const invalid = packageClone();
    invalid.participants[0]!.identity.imageReference = "https://assets.example/lion.webp?token=secret";
    expect(() => parseSimulationRuntimePackageV1(invalid)).toThrow(/credentials/);
  });

  it("serializes deterministically and independently of object key insertion order", () => {
    const normal = serializeSimulationRuntimePackageV1(knockout.package);
    const reversed = Object.fromEntries(Object.entries(knockout.package).reverse());
    expect(serializeSimulationRuntimePackageV1(reversed)).toBe(normal);
    expect(normal.endsWith("\n")).toBe(true);
  });
});
