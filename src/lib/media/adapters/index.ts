import { battleStoryboardAdapter } from "./battle";
import { raceStoryboardAdapter } from "./race";
import { survivalStoryboardAdapter } from "./survival";
import type { StoryboardAdapter } from "./types";

export const STORYBOARD_ADAPTERS: readonly StoryboardAdapter[] = [
  battleStoryboardAdapter,
  raceStoryboardAdapter,
  survivalStoryboardAdapter,
];

export function storyboardAdapterFor(moduleId: string, moduleVersion: string): StoryboardAdapter | null {
  return STORYBOARD_ADAPTERS.find((adapter) => adapter.supports(moduleId, moduleVersion)) ?? null;
}

export function supportsStoryboardSource(moduleId: string, moduleVersion: string): boolean {
  return storyboardAdapterFor(moduleId, moduleVersion) !== null;
}

export type { StoryboardAdapter, StoryboardSourceRun } from "./types";
