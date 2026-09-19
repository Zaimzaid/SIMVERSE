# SIMVERSE Runtime Protocol v1 artifacts

These engine-neutral artifacts are generated from the canonical Zod contract in
`src/lib/runtime-protocol/v1.ts`.

- `simulation-runtime-package.schema.json` describes the transport structure.
- `fixtures/duel-knockout.json` is the canonical knockout duel.
- `fixtures/duel-time-limit.json` is the canonical time-limit duel.
- `fixtures/four-player-free-for-all.json` is the canonical four-participant run.
- `fixtures/manifest.json` records seeds, expected outcomes, event counts,
  hashes, and the originating Platform checkpoint.

The Zod validator is authoritative because it also checks relationships that
JSON Schema cannot express cleanly: event sequence and time order, participant
references, result completeness, completion-event parity, and credential-free
asset references. Runtime implementations must validate those invariants and
use the fixtures as conformance inputs.

Regenerate after an intentional protocol or fixture change:

```powershell
$env:UPDATE_RUNTIME_PROTOCOL_FIXTURES = "1"
npx vitest run test/runtime-protocol-fixtures.test.ts
Remove-Item Env:UPDATE_RUNTIME_PROTOCOL_FIXTURES
```

Normal `npx vitest run` is read-only and fails if generated artifacts drift.
Do not edit generated JSON by hand.
