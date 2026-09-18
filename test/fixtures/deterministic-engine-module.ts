import { z } from "zod";
import type { EngineModule } from "../../src/lib/engine/module";
import { EngineModuleRegistry } from "../../src/lib/engine/registry";

const sampleSchema = z.object({ sample: z.number().int().min(0).max(0xffffffff) }).strict();
const stateSchema = z.object({ steps: z.number().int().nonnegative(), samples: z.array(z.number().int()) }).strict();
const resultSchema = z.object({ steps: z.number().int().positive(), samples: z.array(z.number().int()) }).strict();

/** Test support only. The production registry never imports or registers this module. */
export const deterministicTestModule: EngineModule = {
  mode: "test-sequence",
  id: "test-sequence",
  version: "1",
  stateSchema,
  actionPayloads: { "test.sample": { version: 1, schema: sampleSchema } },
  eventPayloads: { "test.sampled": { version: 1, schema: sampleSchema } },
  resultPayloads: { "test.summary": { version: 1, schema: resultSchema } },
  initialize: () => ({ steps: 0, samples: [] }),
  planActions: (context) => [{
    type: "test.sample",
    actorRunParticipantId: context.input.participants[0]?.runParticipantId ?? null,
    payloadVersion: 1,
    payload: { sample: context.rng.nextUint32() },
  }],
  evaluateRules: (_context, current, action) => {
    const state = stateSchema.parse(current);
    const payload = sampleSchema.parse(action.payload);
    return {
      state: { steps: state.steps + 1, samples: [...state.samples, payload.sample] },
      events: [{
        type: "test.sampled",
        actorRunParticipantId: action.actorRunParticipantId,
        payloadVersion: 1,
        payload,
      }],
    };
  },
  isComplete: (_context, current) => stateSchema.parse(current).steps >= 3,
  buildResult: (_context, current) => {
    const state = stateSchema.parse(current);
    return {
      resultType: "test.summary",
      summary: "Deterministic sequence completed.",
      metrics: { steps: state.steps },
      modulePayloadVersion: 1,
      modulePayload: { steps: state.steps, samples: state.samples },
    };
  },
};

export const deterministicTestRegistry = new EngineModuleRegistry([deterministicTestModule]);
