/**
 * Server-safe model for the project editor form.
 *
 * This module intentionally has NO `"use client"` directive. It holds the plain
 * data shape the form is initialized with, plus the pure mapper that turns a
 * persisted project into that shape. Because it is not a client entry point, a
 * Server Component (the Edit page) can import and CALL `projectToFormInitial`
 * directly. Had this lived in the `"use client"` module `project-form.tsx`, the
 * server would receive a client reference (a proxy), not the function, and
 * calling it during render would throw — see
 * node_modules/next/dist/docs/01-app/02-guides/server-and-client-boundary.md.
 *
 * The client form (`project-form.tsx`) imports these too; type-only imports are
 * erased at build time, so no server code leaks into the client bundle.
 */
import type { ProjectView } from "@/server/services/project-service";
import type { MetadataPair } from "@/components/entities/types";

export interface ProjectFormInitial {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  coverUrl: string;
  metadata: MetadataPair[];
}

/** Build the editable form initializer from a persisted project (edit mode). */
export function projectToFormInitial(project: ProjectView): ProjectFormInitial {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    imageUrl: project.imageUrl ?? "",
    coverUrl: project.coverUrl ?? "",
    metadata: Object.entries(project.metadata ?? {}).map(([key, val], i) => ({
      id: `meta-init-${i}`,
      key,
      value: typeof val === "string" ? val : JSON.stringify(val),
    })),
  };
}
