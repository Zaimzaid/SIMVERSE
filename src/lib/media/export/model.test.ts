import { describe, expect, it } from "vitest";
import type { StoryboardV1 } from "@/lib/media/schemas";
import {
  buildResultGraphic,
  initialsFor,
  resultGraphicV1Schema,
  safeColor,
  seriesColor,
  type BuildResultGraphicInput,
} from "./model";
import { MEDIA_EXPORT_DIMENSIONS } from "./constants";

function storyboard(overrides: Partial<StoryboardV1> = {}): StoryboardV1 {
  return {
    version: 1,
    source: { runId: "run1", simulationId: "sim1", simulationName: "Lion vs Robot", mode: "duel", moduleId: "battle", moduleVersion: "battle-v1" },
    participants: [
      { runParticipantId: "p1", sourceEntityId: "e1", position: 0, name: "Historical Lion", shortName: "Lion", category: "creature", imageUrl: null, primaryColor: "#f59e0b", secondaryColor: null },
      { runParticipantId: "p2", sourceEntityId: "e2", position: 1, name: "Historical Robot", shortName: null, category: "machine", imageUrl: null, primaryColor: "not-a-color", secondaryColor: null },
    ],
    summary: { resultType: "battle", headline: "Lion Wins", detail: "Lion defeated Robot decisively.", completionReason: "KNOCKOUT", winnerParticipantRefs: ["p1"], tiedParticipantRefs: [], ranking: ["p1", "p2"] },
    scenes: [
      { id: "intro", order: 0, kind: "INTRO", title: "Intro", caption: "", participantRefs: [], enabled: true },
      { id: "competitor", order: 1, kind: "COMPETITOR", title: "Fighters", caption: "Two enter.", participantRefs: ["p1", "p2"], enabled: true },
      { id: "clash", order: 2, kind: "HIGHLIGHT", title: "Clash", caption: "Blows traded.", participantRefs: ["p1", "p2"], enabled: true },
      { id: "turn", order: 3, kind: "TURNING_POINT", title: "Critical", caption: "A big hit.", participantRefs: ["p1"], enabled: false },
      { id: "result", order: 4, kind: "RESULT", title: "Result", caption: "Lion wins.", participantRefs: ["p1"], enabled: true },
      { id: "outro", order: 5, kind: "OUTRO", title: "Outro", caption: "", participantRefs: [], enabled: true },
    ],
    ...overrides,
  };
}

function input(story: StoryboardV1, extra: Partial<BuildResultGraphicInput> = {}): BuildResultGraphicInput {
  return {
    artifactId: "a1", artifactVersion: 1, exportType: "RESULT_CARD", aspectRatio: "LANDSCAPE_16_9",
    title: `${story.source.simulationName} Storyboard`, subtitle: story.summary.headline, description: null,
    source: story.source, storyboard: story, ...extra,
  };
}

describe("buildResultGraphic", () => {
  it("produces a schema-valid model with historical participant identity", () => {
    const model = buildResultGraphic(input(storyboard()));
    expect(() => resultGraphicV1Schema.parse(model)).not.toThrow();
    expect(model.participants.map((p) => p.name)).toEqual(["Historical Lion", "Historical Robot"]);
    expect(model.simulationName).toBe("Lion vs Robot");
    expect(model.dimensions).toEqual(MEDIA_EXPORT_DIMENSIONS.LANDSCAPE_16_9);
  });

  it("copies authoritative winner, ranking and completion verbatim", () => {
    const model = buildResultGraphic(input(storyboard()));
    expect(model.result.headline).toBe("Lion Wins");
    expect(model.result.winnerRefs).toEqual(["p1"]);
    expect(model.result.completionReason).toBe("KNOCKOUT");
    expect(model.result.ranking).toEqual([
      { rank: 1, ref: "p1", name: "Historical Lion" },
      { rank: 2, ref: "p2", name: "Historical Robot" },
    ]);
  });

  it("preserves tie / shared-winner truth", () => {
    const tied = storyboard({
      summary: { resultType: "battle", headline: "Draw", detail: "A dead heat.", completionReason: "TIMEOUT", winnerParticipantRefs: [], tiedParticipantRefs: ["p1", "p2"], ranking: ["p1", "p2"] },
    });
    const model = buildResultGraphic(input(tied));
    expect(model.result.winnerRefs).toEqual([]);
    expect(model.result.tiedRefs).toEqual(["p1", "p2"]);
  });

  it("includes bounded, ordered, enabled highlights only for a poster", () => {
    const card = buildResultGraphic(input(storyboard(), { exportType: "RESULT_CARD" }));
    expect(card.highlights).toEqual([]);

    const poster = buildResultGraphic(input(storyboard(), { exportType: "STORY_POSTER" }));
    // excludes RESULT + OUTRO, and the disabled TURNING_POINT scene
    expect(poster.highlights.map((h) => h.title)).toEqual(["Intro", "Fighters", "Clash"]);
    expect(poster.highlights.every((h) => h.kind !== "RESULT" && h.kind !== "OUTRO")).toBe(true);
  });

  it("caps poster highlights at four", () => {
    const many = storyboard({
      scenes: [
        { id: "s0", order: 0, kind: "INTRO", title: "S0", caption: "", participantRefs: [], enabled: true },
        { id: "s1", order: 1, kind: "HIGHLIGHT", title: "S1", caption: "", participantRefs: [], enabled: true },
        { id: "s2", order: 2, kind: "HIGHLIGHT", title: "S2", caption: "", participantRefs: [], enabled: true },
        { id: "s3", order: 3, kind: "HIGHLIGHT", title: "S3", caption: "", participantRefs: [], enabled: true },
        { id: "s4", order: 4, kind: "HIGHLIGHT", title: "S4", caption: "", participantRefs: [], enabled: true },
        { id: "result", order: 5, kind: "RESULT", title: "Result", caption: "", participantRefs: [], enabled: true },
      ],
    });
    const poster = buildResultGraphic(input(many, { exportType: "STORY_POSTER" }));
    expect(poster.highlights).toHaveLength(4);
    expect(poster.highlights.map((h) => h.title)).toEqual(["S0", "S1", "S2", "S3"]);
  });

  it("resolves participant colors and initials safely", () => {
    const model = buildResultGraphic(input(storyboard()));
    expect(model.participants[0]!.color).toBe("#f59e0b");
    // "not-a-color" is rejected and falls back to a brand series color
    expect(model.participants[1]!.color).toBe(seriesColor(1));
    expect(model.participants[0]!.initials).toBe("LI");
    expect(model.participants[1]!.initials).toBe("HR"); // Historical Robot → H + R
  });

  it("maps every aspect ratio to its exact approved dimensions", () => {
    for (const ratio of ["LANDSCAPE_16_9", "PORTRAIT_9_16", "SQUARE_1_1"] as const) {
      const model = buildResultGraphic(input(storyboard(), { aspectRatio: ratio }));
      expect(model.dimensions).toEqual(MEDIA_EXPORT_DIMENSIONS[ratio]);
    }
  });
});

describe("export model helpers", () => {
  it("safeColor accepts hex and rejects everything else", () => {
    expect(safeColor("#fff")).toBe("#fff");
    expect(safeColor("#22d3ee")).toBe("#22d3ee");
    expect(safeColor("#22d3eeff")).toBe("#22d3eeff");
    expect(safeColor("red")).toBeNull();
    expect(safeColor("rgb(1,2,3)")).toBeNull();
    expect(safeColor("url(#x)")).toBeNull();
    expect(safeColor("<script>")).toBeNull();
    expect(safeColor(null)).toBeNull();
  });

  it("initialsFor handles multi-word, single-word and empty names", () => {
    expect(initialsFor("Lion")).toBe("LI");
    expect(initialsFor("Robot Runner")).toBe("RR");
    expect(initialsFor("a b c d")).toBe("AD");
    expect(initialsFor("   ")).toBe("—");
  });
});
