/**
 * Server-safe model for the entity editor form.
 *
 * This module intentionally has NO `"use client"` directive. It holds the plain
 * data shape the form is initialized with, plus the pure mapper that turns a
 * persisted entity into that shape. Because it is not a client entry point, a
 * Server Component (the Edit page) can import and CALL `entityToFormInitial`
 * directly. Had this lived in the `"use client"` module `entity-form.tsx`, the
 * server would receive a client reference (a proxy), not the function, and
 * calling it during render would throw — see
 * node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md.
 *
 * The client form (`entity-form.tsx`) imports these too; type-only imports are
 * erased at build time, so no server code leaks into the client bundle.
 */
import type { EntityView } from "@/server/services/entity-service";
import type { AttributeAssignment, MetadataPair } from "./types";

export interface EntityFormInitial {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  imageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  attributes: AttributeAssignment[];
  tags: string[];
  metadata: MetadataPair[];
}

/** Build the editable form initializer from a persisted entity (edit mode). */
export function entityToFormInitial(entity: EntityView): EntityFormInitial {
  return {
    id: entity.id,
    name: entity.name,
    shortName: entity.shortName ?? "",
    description: entity.description ?? "",
    category: entity.category,
    imageUrl: entity.imageUrl ?? "",
    primaryColor: entity.primaryColor ?? "",
    secondaryColor: entity.secondaryColor ?? "",
    attributes: entity.attributes.map((a) => ({
      attributeDefinitionId: a.attributeDefinitionId,
      value: a.rawValue,
    })),
    tags: entity.tags.map((t) => t.name),
    metadata: Object.entries(entity.metadata ?? {}).map(([key, val], i) => ({
      id: `meta-init-${i}`,
      key,
      value: typeof val === "string" ? val : JSON.stringify(val),
    })),
  };
}
