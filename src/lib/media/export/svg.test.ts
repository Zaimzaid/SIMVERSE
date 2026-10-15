import { describe, expect, it } from "vitest";
import type { StoryboardV1 } from "@/lib/media/schemas";
import { buildResultGraphic, type BuildResultGraphicInput } from "./model";
import { escapeXml, renderResultGraphicSvg } from "./svg";
import { MAX_EXPORT_SVG_BYTES, MEDIA_EXPORT_DIMENSIONS } from "./constants";

function storyboard(overrides: Partial<StoryboardV1["summary"]> = {}, sceneCaption = "A caption."): StoryboardV1 {
  return {
    version: 1,
    source: { runId: "run1", simulationId: "sim1", simulationName: "Lion vs Robot", mode: "duel", moduleId: "battle", moduleVersion: "battle-v1" },
    participants: [
      { runParticipantId: "p1", sourceEntityId: "e1", position: 0, name: "Lion", shortName: "Lion", category: "creature", imageUrl: null, primaryColor: "#f59e0b", secondaryColor: null },
      { runParticipantId: "p2", sourceEntityId: "e2", position: 1, name: "Robot", shortName: "Robot", category: "machine", imageUrl: null, primaryColor: "#3b82f6", secondaryColor: null },
    ],
    summary: { resultType: "battle", headline: "Lion Wins", detail: "Lion defeated Robot.", completionReason: "KNOCKOUT", winnerParticipantRefs: ["p1"], tiedParticipantRefs: [], ranking: ["p1", "p2"], ...overrides },
    scenes: [
      { id: "intro", order: 0, kind: "INTRO", title: "Intro", caption: sceneCaption, participantRefs: [], enabled: true },
      { id: "clash", order: 1, kind: "HIGHLIGHT", title: "Clash", caption: sceneCaption, participantRefs: ["p1"], enabled: true },
      { id: "result", order: 2, kind: "RESULT", title: "Result", caption: "Won.", participantRefs: ["p1"], enabled: true },
    ],
  };
}

function model(extra: Partial<BuildResultGraphicInput> = {}, summary?: Partial<StoryboardV1["summary"]>, caption?: string) {
  const story = storyboard(summary, caption);
  return buildResultGraphic({
    artifactId: "a1", artifactVersion: 1, exportType: "RESULT_CARD", aspectRatio: "LANDSCAPE_16_9",
    title: `${story.source.simulationName} Storyboard`, subtitle: story.summary.headline, description: null,
    source: story.source, storyboard: story, ...extra,
  });
}

describe("escapeXml", () => {
  it("escapes all five XML metacharacters", () => {
    expect(escapeXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;");
    expect(escapeXml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("renderResultGraphicSvg", () => {
  it("emits a valid, self-contained SVG root", () => {
    const svg = renderResultGraphicSvg(model());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("SIMVERSE");
    expect(svg).toContain("LION WINS");
  });

  it("maps each aspect ratio to exact output dimensions", () => {
    for (const ratio of ["LANDSCAPE_16_9", "PORTRAIT_9_16", "SQUARE_1_1"] as const) {
      const { width, height } = MEDIA_EXPORT_DIMENSIONS[ratio];
      const svg = renderResultGraphicSvg(model({ aspectRatio: ratio }));
      expect(svg).toContain(`width="${width}" height="${height}"`);
      expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`);
    }
  });

  it("is deterministic for the same model", () => {
    const m = model();
    expect(renderResultGraphicSvg(m)).toBe(renderResultGraphicSvg(m));
  });

  it("neutralizes script injection in the authoritative headline", () => {
    const svg = renderResultGraphicSvg(model({}, { headline: "<script>alert(1)</script>" }));
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("</script>");
    expect(svg).toContain("&lt;SCRIPT&gt;"); // headline is uppercased, then escaped
  });

  it("neutralizes attribute-breakout injection in creator title and captions", () => {
    const payload = `"><image href="file:///etc/passwd"/>`;
    const svg = renderResultGraphicSvg(model({ title: payload, exportType: "STORY_POSTER" }, undefined, payload));
    // The literal breakout must never appear as live markup.
    expect(svg).not.toContain('<image href="file:///etc/passwd"');
    expect(svg).not.toContain('"><image');
    expect(svg).toContain("&lt;image");
    expect(svg).toContain("&quot;&gt;");
  });

  it("stays within the bounded size budget", () => {
    const svg = renderResultGraphicSvg(model({ exportType: "STORY_POSTER" }));
    expect(new TextEncoder().encode(svg).length).toBeLessThan(MAX_EXPORT_SVG_BYTES);
  });
});
