import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROTOCOL_VERSION_V1,
  parseSimulationRuntimePackageV1,
  serializeSimulationRuntimePackageV1,
  simulationRuntimePackageJsonSchemaV1,
} from "@/lib/runtime-protocol/v1";
import {
  RUNTIME_FIXTURE_ORIGIN_CHECKPOINT,
  generateRuntimeProtocolFixtures,
} from "./fixtures/runtime-protocol-scenarios";

const artifactDirectory = path.join(process.cwd(), "protocol", "runtime", "v1");
const fixturesDirectory = path.join(artifactDirectory, "fixtures");
const updateArtifacts = process.env.UPDATE_RUNTIME_PROTOCOL_FIXTURES === "1";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function artifacts() {
  const fixtures = generateRuntimeProtocolFixtures();
  const fixtureFiles = new Map(fixtures.map((fixture) => [
    fixture.filename,
    serializeSimulationRuntimePackageV1(fixture.package),
  ]));
  const manifest = {
    protocolVersion: RUNTIME_PROTOCOL_VERSION_V1,
    originatingPlatformCheckpoint: RUNTIME_FIXTURE_ORIGIN_CHECKPOINT,
    fixtures: fixtures.map((fixture) => {
      const content = fixtureFiles.get(fixture.filename)!;
      const result = fixture.package.result.payload;
      return {
        file: fixture.filename,
        scenario: fixture.scenario,
        seed: fixture.seed,
        expectedCompletionReason: result.completionReason,
        expectedWinnerRunParticipantId: result.winnerRunParticipantId,
        expectedTiedParticipantIds: result.tiedParticipantIds,
        ranking: result.ranking,
        eventCount: fixture.package.events.length,
        sha256: sha256(content),
      };
    }),
  };
  return {
    fixtures,
    fixtureFiles,
    manifest: serialize(manifest),
    schema: serialize(simulationRuntimePackageJsonSchemaV1()),
  };
}

function writeArtifacts(): void {
  const generated = artifacts();
  fs.mkdirSync(fixturesDirectory, { recursive: true });
  for (const [filename, content] of generated.fixtureFiles) {
    fs.writeFileSync(path.join(fixturesDirectory, filename), content);
  }
  fs.writeFileSync(path.join(fixturesDirectory, "manifest.json"), generated.manifest);
  fs.writeFileSync(path.join(artifactDirectory, "simulation-runtime-package.schema.json"), generated.schema);
}

if (updateArtifacts) writeArtifacts();

describe("Runtime Protocol v1 generated artifacts", () => {
  const generated = artifacts();

  it("keeps generated JSON Schema synchronized with the canonical Zod validator", () => {
    expect(fs.readFileSync(path.join(artifactDirectory, "simulation-runtime-package.schema.json"), "utf8"))
      .toBe(generated.schema);
  });

  it("records deterministic fixture provenance, outcomes, counts and hashes", () => {
    expect(fs.readFileSync(path.join(fixturesDirectory, "manifest.json"), "utf8"))
      .toBe(generated.manifest);
  });

  it.each(generated.fixtures)("regenerates $scenario deterministically", (fixture) => {
    const checkedIn = fs.readFileSync(path.join(fixturesDirectory, fixture.filename), "utf8");
    expect(checkedIn).toBe(generated.fixtureFiles.get(fixture.filename));
    expect(parseSimulationRuntimePackageV1(JSON.parse(checkedIn))).toEqual(fixture.package);
  });

  it("contains only the three canonical fixture packages and their manifest", () => {
    expect(fs.readdirSync(fixturesDirectory).sort()).toEqual([
      "duel-knockout.json",
      "duel-time-limit.json",
      "four-player-free-for-all.json",
      "manifest.json",
    ]);
  });
});
