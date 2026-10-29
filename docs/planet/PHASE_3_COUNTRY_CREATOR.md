# SIMVERSE Planet — Phase 3 Country Creator

Status: source implementation on feature/planet-country-creator-phase3. **Do not claim browser visual acceptance until verified.**
Baseline: Signature Orbital Planet V1.1 (stacked over PR #39), fictional geography backend Phases 1–2 in master.

## Product flow

A signed-in, independently authorized SIMVERSE Planet steward visits `/planet/create` from the `/planet` World Status panel.

1. **Name your country** — name, optional description, territory color.
2. **Shape the territory** — place an original editable starter country on the spherical planet, adjust radius, drag/rotate the view, or draw a custom closed boundary by tapping the planet and choosing Finish border. Undo mistaken points. A glowing outline, markers and translucent fill visualize the territory on the curved surface.
3. **Save private draft** — create/edit using the existing authenticated `/api/planet/admin/countries` endpoints. The API is authoritative; saving a draft never publishes it.
4. **Open a saved country** — recover its latest stored draft revision and continue editing (new immutable revision).
5. **Publish** — only with separate canPublish steward grant and valid previously saved draft. API verifies topology and conflicts with other published countries.

The editor does NOT create Galex automatically and DOES NOT give random workspace members publication rights. The empty-state `/planet` view is still a separate Stage 1 visual proof; **published countries are discoverable in API but not yet displayed on the public orbital planet**. That is Phase 4.

### Authorization

The /planet/create route requires an authenticated platform context. It additionally checks `getPlanetCreatorAccess`, requiring OWNER or ADMIN membership plus an active `FictionalPlanetSteward` grant. All mutating API routes independently enforce their service-side grants. Non-stewards see a friendly access explanation without any controls to self-grant access.

A trusted operator with access to the local developer database can enroll an existing owner/admin account:

```powershell
npm run db:push
node scripts/grant-fictional-planet-steward.mjs --email=YOUR_EXISTING_OWNER_EMAIL --publish --confirm
npm run dev
```

This must use the actual operator-approved account and the correct development database. Do not enter real credentials or create fictitious administrator accounts; do not use the script on production without an audited operator procedure.

### Scope/limitations

- Shape editor supports a single closed shell per country for now. Phase 2 API supports polygon holes and MultiPolygon when authored through protected APIs, but Phase 3 UI primarily previews/edits the first shell of such records.
- Country surface areas use fictional radius 6000km and are approximate. Size slider means approximate **radius**, not exact area.
- Click/tap chooses fictional planet-local longitude/latitude. Large or invalid shapes are rejected by backend validator.
- The creator does not yet support on-globe vertex dragging, multiple disconnected islands in the UI, undo/redo history beyond current draw points, imported GeoJSON editing, or world/parcel binding. Avoid implying these are completed.
- The `Finish border` operation validates client geometry; server validates again on save/publish.
- This branch does not modify legacy Earth country/land records or production databases.
- User-authored draft publication conflicts are rejected. Cross-process database publish serialization will require a dedicated concurrency/load gate before a multi-admin public production rollout.

## Verification gates

- CI: Prisma db push, typecheck, lint, all tests and build.
- Browser QA: `/planet` entry link, signed-in vs signed-out and steward/no-steward, 390px and desktop layout, scene picking on rotated planet, orbit with mouse/touch, generate shape and slider, manual 3–5 point draw/undo/close, save/refresh/reopen/publish, area and conflict error display.
- No user-created data destroyed, no default country seeded.
- Visual UI review before merging the stacked PR.

## Branch relationship

- PR #39 is V1.1 visual refinement from master.
- The Phase 3 branch starts from PR #39's head to preserve the approved visual code. Its PR targets `feature/planet-visual-refinement-v11` initially.
- Once V1.1 is visually approved and merged, retarget/rebase Phase 3 to master for normal integration; do not accidentally merge unfinished changes into master.
