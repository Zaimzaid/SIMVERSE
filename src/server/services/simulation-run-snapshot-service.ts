import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ValidationError, NotFoundError } from "@/lib/errors";
import {
  configurationSnapshotSchema, inputSnapshotSchema, jsonRecordSchema,
  participantSnapshotSchema, presentationSnapshotSchema,
  type InputSnapshotV1, type JsonRecord,
} from "@/lib/engine/schemas";
import { INPUT_SNAPSHOT_VERSION } from "@/lib/engine/constants";
import { normalizeConfigInput, normalizePresentationInput } from "@/lib/simulations/config";
import { minEntitiesForMode } from "@/lib/simulations/modes";
import { isValidSeed } from "@/lib/simulations/seed";
import { animationProfileSchema } from "@/lib/visuals/profile";
import { loadWorldRunSnapshot } from "./world-service";

const snapshotInclude = {
  entityLinks: {
    include: {
      entity: {
        include: {
          entityTags: { include: { tag: true }, orderBy: { tagId: "asc" } },
          attributeValues: {
            include: { attributeDefinition: true },
            orderBy: { attributeDefinitionId: "asc" },
          },
          visualProfile: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { entityId: "asc" }],
  },
} satisfies Prisma.SimulationInclude;

function parseRecord(json: string | null, label: string): JsonRecord | null {
  if (!json) return null;
  try {
    return jsonRecordSchema.parse(JSON.parse(json));
  } catch {
    throw new ValidationError(`${label} is invalid for execution.`);
  }
}

function parseOptions(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  } catch {
    // A malformed stored definition is an invalid execution input.
  }
  throw new ValidationError("An entity attribute definition is invalid for execution.");
}

function parseAnimationProfile(json: string | null) {
  if (!json) return {};
  try {
    return animationProfileSchema.parse(JSON.parse(json));
  } catch {
    throw new ValidationError("An Entity Visual Profile animation mapping is invalid for execution.");
  }
}

/** Capture every execution input inside the same transaction that creates a Run. */
export async function buildRunInputSnapshot(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  simulationId: string,
): Promise<InputSnapshotV1> {
  const simulation = await tx.simulation.findFirst({
    where: { id: simulationId, workspaceId },
    include: snapshotInclude,
  });
  if (!simulation) throw new NotFoundError("Simulation not found.");
  if (simulation.status !== "READY") throw new ValidationError("Simulation is not ready.");
  if (!simulation.seed || !isValidSeed(simulation.seed)) {
    throw new ValidationError("Simulation seed is invalid for execution.");
  }
  if (simulation.configVersion !== 1 || !simulation.configuration) {
    throw new ValidationError("Simulation configuration version is unavailable for execution.");
  }
  if (simulation.entityLinks.length < minEntitiesForMode(simulation.mode)) {
    throw new ValidationError("Simulation no longer has enough participants to run.");
  }

  let configuration: InputSnapshotV1["configuration"];
  let presentation: InputSnapshotV1["presentation"];
  try {
    const rawConfiguration: unknown = JSON.parse(simulation.configuration);
    const stored = configurationSnapshotSchema.parse(rawConfiguration);
    configuration = configurationSnapshotSchema.parse(normalizeConfigInput(simulation.mode, stored));
    const rawPresentation: unknown = simulation.presentation ? JSON.parse(simulation.presentation) : {};
    presentation = presentationSnapshotSchema.parse(normalizePresentationInput(rawPresentation));
  } catch {
    throw new ValidationError("Simulation configuration is invalid for execution.");
  }

  const participants = simulation.entityLinks.map((link, position) => {
    const entity = link.entity;
    if (entity.workspaceId !== workspaceId) {
      throw new ValidationError("A participant is not in this workspace.");
    }
    const attributes = entity.attributeValues.map((value) => {
      const definition = value.attributeDefinition;
      if (definition.workspaceId !== workspaceId) {
        throw new ValidationError("An attribute is not in this workspace.");
      }
      return {
        definitionId: definition.id,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        dataType: definition.dataType,
        unit: definition.unit,
        minimum: definition.minimum,
        maximum: definition.maximum,
        options: parseOptions(definition.options),
        defaultValue: definition.defaultValue,
        isBuiltIn: definition.isBuiltIn,
        value: value.value,
      };
    });
    const visual = entity.visualProfile?.enabled ? entity.visualProfile : null;
    return participantSnapshotSchema.parse({
      runParticipantId: randomUUID(),
      sourceEntityId: entity.id,
      position,
      role: link.role,
      overrides: parseRecord(link.overrides, "Participant overrides"),
      name: entity.name,
      shortName: entity.shortName,
      description: entity.description,
      category: entity.category,
      status: entity.status,
      imageUrl: entity.imageUrl,
      primaryColor: entity.primaryColor,
      secondaryColor: entity.secondaryColor,
      metadata: parseRecord(entity.metadata, "Entity metadata"),
      visualProfileVersion: 1,
      visualProfile: visual ? {
        version: 1,
        profileRevision: visual.revision,
        sourceType: visual.sourceType,
        portraitUrl: visual.portraitUrl ?? undefined,
        modelUrl: visual.modelUrl ?? undefined,
        archetype: visual.archetype,
        scale: visual.scale,
        rotationX: visual.rotationX,
        rotationY: visual.rotationY,
        rotationZ: visual.rotationZ,
        offsetX: visual.offsetX,
        offsetY: visual.offsetY,
        offsetZ: visual.offsetZ,
        animationProfile: parseAnimationProfile(visual.animationProfile),
        enabled: visual.enabled,
      } : null,
      tags: entity.entityTags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
      attributes,
    });
  });

  const world = simulation.worldId && simulation.worldVersion
    ? await loadWorldRunSnapshot(tx, workspaceId, simulation.worldId, simulation.worldVersion)
    : null;

  return inputSnapshotSchema.parse({
    version: INPUT_SNAPSHOT_VERSION,
    simulationId: simulation.id,
    simulationName: simulation.name,
    mode: simulation.mode,
    configVersion: simulation.configVersion,
    configuration,
    presentation,
    resolvedSeed: simulation.seed,
    participants,
    world,
  });
}
