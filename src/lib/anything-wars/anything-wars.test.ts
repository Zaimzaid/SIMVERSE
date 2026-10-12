import { describe, expect, it } from "vitest";
import {
  ANYTHING_WARS_EVENT_MODES,
  ANYTHING_WARS_FUTURE_MODES,
  anythingWarsExecutionIssue,
  anythingWarsParticipantLimit,
  isAnythingWarsEventMode,
} from "./constants";
import { anythingWarsEventHref, anythingWarsRematchHref, anythingWarsRunHref, anythingWarsWatchHref } from "./routes";
import { defaultRaceConfigV1 } from "@/lib/modules/race/config";
import { defaultSurvivalConfigV1 } from "@/lib/modules/survival/config";

describe("Anything Wars v0 product contract", () => {
  it("exposes only executable event modes and keeps future modes disabled", () => {
    expect(ANYTHING_WARS_EVENT_MODES).toEqual(["battle", "race", "survival"]);
    expect(ANYTHING_WARS_FUTURE_MODES).toContain("Economy");
    expect(isAnythingWarsEventMode("battle")).toBe(true);
    expect(isAnythingWarsEventMode("tournament")).toBe(false);
    expect(isAnythingWarsEventMode("economy")).toBe(false);
  });

  it("delegates participant eligibility to existing module rules", () => {
    expect(anythingWarsExecutionIssue("battle", { format: "duel" }, 2)).toBeNull();
    expect(anythingWarsExecutionIssue("battle", { format: "duel" }, 3)).toContain("exactly two");
    expect(anythingWarsExecutionIssue("race", defaultRaceConfigV1(), 65)).toContain("at most 64");
    expect(anythingWarsExecutionIssue("survival", defaultSurvivalConfigV1(), 1)).toContain("at least 2");
    expect(anythingWarsParticipantLimit("race")).toBe(64);
    expect(anythingWarsParticipantLimit("survival")).toBe(64);
    expect(anythingWarsParticipantLimit("battle")).toBeUndefined();
  });

  it("builds product result, replay, and rematch routes safely", () => {
    expect(anythingWarsEventHref("event/one")).toBe("/anything-wars/events/event%2Fone");
    expect(anythingWarsRunHref("event", "run/one")).toBe("/anything-wars/events/event/runs/run%2Fone");
    expect(anythingWarsWatchHref("event", "run")).toBe("/anything-wars/events/event/runs/run/watch");
    expect(anythingWarsRematchHref("event one")).toBe("/anything-wars/create?rematch=event%20one");
  });
});
