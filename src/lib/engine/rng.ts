import { z } from "zod";

/** FNV-1a seed hashing and Mulberry32 output are fixed for replay compatibility. */
export const RNG_ALGORITHM_VERSION = "mulberry32-v1";

export const rngStateSchema = z.object({
  version: z.literal(RNG_ALGORITHM_VERSION),
  value: z.number().int().min(0).max(0xffffffff),
}).strict();
export type RngState = z.infer<typeof rngStateSchema>;

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRng {
  private value: number;

  constructor(state: RngState) {
    this.value = rngStateSchema.parse(state).value;
  }

  static fromSeed(seed: string): SeededRng {
    return new SeededRng({ version: RNG_ALGORITHM_VERSION, value: hashSeed(seed) });
  }

  nextUint32(): number {
    this.value = (this.value + 0x6d2b79f5) >>> 0;
    let t = this.value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x1_0000_0000;
  }

  snapshot(): RngState {
    return { version: RNG_ALGORITHM_VERSION, value: this.value };
  }
}
