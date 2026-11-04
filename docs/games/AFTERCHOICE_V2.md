# AFTERCHOICE — Phase 2: The Three Nights

This phase is a separate playable mode layered on Phase 1 (see `docs/games/AFTERCHOICE_V1.md`).

**Game location:** `/games/afterchoice/campaign` (authenticated users). The Phase 1 page has a direct link to this mode.

## New player experience

Players must manage four linked city systems over three connected nights. A nightly response can contain up to two unique interventions and costs at most five credits. The budget refreshes each night; resource levels do **not** reset.

An intervention can have:
- An immediate effect, applied in the order selected that night.
- A **next-night** delayed effect (positive or negative), previewed before the player commits.
- Side-effects affecting other resources.

At the start of the following night, previously scheduled consequences activate automatically. Delayed effects are applied exactly once, and actions may be chosen again on later nights.

Every night the challenger studies the state *after* the plan, before learning the chosen safeguard. The challenger considers:
1. Total projected shortages if it launches each possible attack, including the associated cascade triggered by a resource dropping below a threshold.
2. On equal shortages, a small preference for resources that remained below target the previous night.
3. On equal shortages, a small penalty for repeating the previous attack.
4. A fixed declared priority as the final tie-breaker.

Thus the challenger is deterministic, reactive to history and reproducible; it is **not** an LLM or human opponent. Safeguard selection is deliberately not fed into threat choice.

When an attack lands, a matching precommitted safeguard restores the corresponding resource. The engine then checks whether the post-defence resource is still below its *cascade threshold* and applies the chain reaction if so. Matching the attack does not magically prevent a cascade where the resource is still critically low.

The game records the starting resources, applied delayed effects, planned values, attack, aftermath, safeguard, cascade and score for each night. Final-night stability decides whether the city survives. The campaign average and number of stable nights reward steady performance rather than a single lucky turn.

**Scoring:** up to 60 for final resource targets (15 each), 20 for a correct defence, 10 for credit efficiency and 10 for surplus resilience. Scores never exceed 100.

## Files
- `src/lib/afterchoice/campaign.ts`: campaign state machine, delayed effects, adaptive challenger, cascade, scoring.
- `src/lib/afterchoice/campaign.test.ts`: deterministic tests, invalid actions, chained outcomes, simulated 3-night victory.
- `src/components/afterchoice/campaign-game.tsx`: campaign UI including scenario timeline and consequence log.
- `src/app/(platform)/games/afterchoice/campaign/page.tsx`: authenticated route.
- `src/components/afterchoice/game.tsx`: added entry point from the original solo trials.

## Boundaries and testing

Phase 2 is a browser-local **practice mode**. No multiplayer/AI service, account-wide score persistence, virtual currency, rewards, or changes to district governance. Campaign state resets on browser refresh and is not authoritative. No database schema or migrations are needed.

To verify on the new feature branch:
```powershell
git fetch origin
git switch --track origin/feature/afterchoice-campaign-v2-20261104
npx vitest run src/lib/afterchoice/engine.test.ts src/lib/afterchoice/campaign.test.ts
npm run typecheck
npm run lint
npm run build
npm run dev
```

Then visit `http://localhost:3000/games/afterchoice/campaign` signed in and complete all three nights. Test both a correct and incorrect defence; provoke a cascade; confirm delayed events activate once; review narrow layouts and keyboard controls.

**Do not merge until CI and manual QA are complete.** Phase 3 candidates: two-player Architect/Challenger turns, server-owned match state, ranked and casual queues, spectator interface, matchmaking and secure score submission.
