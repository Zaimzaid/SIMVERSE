import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { EntityView } from "@/server/services/entity-service";
import { entityToFormInitial } from "./entity-form-model";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Build a full, type-correct EntityView with sensible defaults for tests. */
function makeEntity(overrides: Partial<EntityView> = {}): EntityView {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "ent_1",
    workspaceId: "ws_1",
    name: "Nigeria",
    shortName: null,
    description: null,
    category: "country",
    imageUrl: null,
    primaryColor: null,
    secondaryColor: null,
    status: "ACTIVE",
    metadata: null,
    tags: [],
    attributes: [],
    createdByName: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides,
  };
}

describe("entityToFormInitial", () => {
  it("coerces null optionals to empty strings (so controlled inputs stay controlled)", () => {
    const initial = entityToFormInitial(makeEntity({ name: "Titan X", category: "vehicle" }));
    expect(initial.id).toBe("ent_1");
    expect(initial.name).toBe("Titan X");
    expect(initial.category).toBe("vehicle");
    expect(initial.shortName).toBe("");
    expect(initial.description).toBe("");
    expect(initial.imageUrl).toBe("");
    expect(initial.primaryColor).toBe("");
    expect(initial.secondaryColor).toBe("");
    expect(initial.tags).toEqual([]);
    expect(initial.attributes).toEqual([]);
    expect(initial.metadata).toEqual([]);
  });

  it("carries through provided identity and appearance values", () => {
    const initial = entityToFormInitial(
      makeEntity({
        shortName: "NG",
        description: "West African nation",
        imageUrl: "https://example.com/flag.png",
        primaryColor: "#00FF00",
        secondaryColor: "#FFFFFF",
      }),
    );
    expect(initial.shortName).toBe("NG");
    expect(initial.description).toBe("West African nation");
    expect(initial.imageUrl).toBe("https://example.com/flag.png");
    expect(initial.primaryColor).toBe("#00FF00");
    expect(initial.secondaryColor).toBe("#FFFFFF");
  });

  it("maps attribute assignments using the canonical rawValue (edit round-trip)", () => {
    const initial = entityToFormInitial(
      makeEntity({
        attributes: [
          {
            attributeDefinitionId: "def_speed",
            key: "speed",
            name: "Speed",
            dataType: "NUMBER",
            unit: null,
            minimum: 0,
            maximum: 100,
            value: 72,
            rawValue: "72",
          },
        ],
      }),
    );
    expect(initial.attributes).toEqual([{ attributeDefinitionId: "def_speed", value: "72" }]);
  });

  it("maps tags to their names", () => {
    const initial = entityToFormInitial(
      makeEntity({
        tags: [
          { id: "t1", name: "africa", slug: "africa" },
          { id: "t2", name: "g20", slug: "g20" },
        ],
      }),
    );
    expect(initial.tags).toEqual(["africa", "g20"]);
  });

  it("turns the metadata object into ordered key/value pairs, stringifying non-strings", () => {
    const initial = entityToFormInitial(
      makeEntity({ metadata: { region: "West Africa", population: 223000000 } }),
    );
    expect(initial.metadata).toEqual([
      { id: "meta-init-0", key: "region", value: "West Africa" },
      { id: "meta-init-1", key: "population", value: "223000000" },
    ]);
  });
});

/**
 * Regression: Bug 1 — the Entity Edit page rendered "Something went wrong".
 *
 * Root cause: the Server Component Edit page called `entityToFormInitial()`, but
 * that function was exported from a `"use client"` module. A Server Component
 * importing an export from a client-entry module receives a client-reference
 * proxy, not the function, so calling it during render throws. The fix moved the
 * mapper into this server-safe (no `"use client"`) module. These guards fail if
 * the boundary is reintroduced.
 */
describe("server/client boundary (Bug 1 regression)", () => {
  it("entityToFormInitial is a real callable function, not a client reference", () => {
    expect(typeof entityToFormInitial).toBe("function");
  });

  it("entity-form-model has no 'use client' directive", () => {
    const source = readFileSync(path.join(here, "entity-form-model.ts"), "utf8");
    expect(source).not.toMatch(/^\s*["']use client["']/m);
  });

  it("the Edit page imports entityToFormInitial from the server-safe model module", () => {
    const editPage = readFileSync(
      path.join(here, "..", "..", "app", "(platform)", "entities", "[entityId]", "edit", "page.tsx"),
      "utf8",
    );
    // Imported from entity-form-model (server-safe)…
    expect(editPage).toMatch(
      /import\s*\{\s*entityToFormInitial\s*\}\s*from\s*["']@\/components\/entities\/entity-form-model["']/,
    );
    // …and NOT from the "use client" entity-form module.
    expect(editPage).not.toMatch(
      /entityToFormInitial[^\n]*from\s*["']@\/components\/entities\/entity-form["']/,
    );
  });
});
