import { ValidationError } from "@/lib/errors";

export interface SimulationClock {
  tick: number;
  simulatedTimeMs: number;
  fixedStepMs: number;
}

export function nextClock(currentTick: number, fixedStepMs: number): SimulationClock {
  const tick = currentTick + 1;
  const simulatedTimeMs = tick * fixedStepMs;
  if (!Number.isSafeInteger(tick) || !Number.isSafeInteger(simulatedTimeMs) ||
      !Number.isSafeInteger(fixedStepMs) || fixedStepMs < 1) {
    throw new ValidationError("Simulation clock limit reached.");
  }
  return { tick, simulatedTimeMs, fixedStepMs };
}
