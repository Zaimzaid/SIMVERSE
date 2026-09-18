import { ConflictError } from "@/lib/errors";

export const CORE_ENGINE_VERSION = "core-v0.1";
export const INPUT_SNAPSHOT_VERSION = 1;
export const ENGINE_STATE_VERSION = 1;
export const RESULT_VERSION = 1;
export const DEFAULT_FIXED_STEP_MS = 100;

export const RUN_STATUSES = [
  "CREATED", "RUNNING", "PAUSED", "COMPLETED", "FAILED", "CANCELLED",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

const TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  CREATED: ["RUNNING", "CANCELLED"],
  RUNNING: ["PAUSED", "COMPLETED", "FAILED", "CANCELLED"],
  PAUSED: ["RUNNING", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isRunStatus(value: string): value is RunStatus {
  return (RUN_STATUSES as readonly string[]).includes(value);
}

/** The only authority for run lifecycle transitions. */
export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Run cannot transition from ${from} to ${to}.`);
  }
}
