# AFTERCHOICE V1 — playable solo practice

Route: `/games/afterchoice` (requires KAVANDRO sign-in).

## What works
- Three crisis scenarios with four interdependent resources, intervention costs and resource trade-offs.
- A plan builder with an action limit and budget cap.
- Three known possible attacks per scenario; the challenger deterministically chooses the one causing the most projected shortage across the four target resources.
- One precommitted safeguard which works only when it predicts the chosen attack.
- Verdict, consequence timeline, retries, chapter selection, and browser-local personal-best scores.
- Engine tests covering plan validation, deterministic attacks, mitigation, and viable winning plans.

This is not online PvP, server-authored scorekeeping, real currency, district rewards, or 3D gameplay.

## Scoring
15 points per system that meets its final target (maximum 60);
25 points for a matched safeguard;
up to 10 for unused credits;
up to 5 for surplus resources;
total maximum 100.
A win requires all four resource targets to be met after the attack.

## Test the feature
From a safe local checkout with a configured development environment:

```powershell
git fetch origin
git switch feature/afterchoice-foundation-v1-20261104
npm ci
npx vitest run src/lib/afterchoice/engine.test.ts
npm run typecheck
npm run lint
npm run build
npm run dev
```

Sign into a test account and open `http://localhost:3000/games/afterchoice`. Never reset a real account database for a game prototype.

## Scope and acceptance gates
The implementation is committed on a feature branch, not yet production verified. Before merging or release, run the project gates and browser QA on desktop/mobile, check light/dark themes and accessibility, and test difficulty with people unfamiliar with the rules.

Next: connected multi-turn cascades, difficulty tuning, new scenarios, server-authoritative multiplayer, alternating Architect/Challenger roles, anti-cheat checks, rankings and moderated tournaments. Player scores are **not** authoritative in V1. Review the working title before public launch.
