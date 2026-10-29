# SIMVERSE Universal Marketplace — P1–P4 implementation checkpoint

**Status:** feature branch for review; **not merged or deployed**. The approved complete specification is `SIMVERSE_UNIVERSAL_MARKETPLACE_SPEC_V1.md` (maintained separately).

## What has actually been added

- Global marketplace tables separate from private Asset Library: seller, listing, free entitlements, wishlist, purchase-order scaffold, trade-offer scaffold, independent moderator grant.
- `/marketplace`: browse/search/filter/pagination and truthful empty state.
- `/marketplace/[listingId]`: product detail, license explanation, free acquisition and wishlist actions.
- `/marketplace/sell`: store enrollment, free listing drafts, review submission and seller listing status.
- `/marketplace/library`: acquired entitlements and explicit licensed-reference import into the buyer's active workspace Asset Library. Imports are idempotently recorded per entitlement/workspace.
- `/marketplace/moderation`: independent moderator queue, approval/rejection endpoint and self-review prohibition.
- `/api/marketplace`: catalog/read scopes and permission-checked mutation actions.
- Marketplace appears in platform navigation.
- Contracts tests enforce free-only acquisition and fail-closed paid and trading boundaries.

## Actual phase-by-phase status

| Phase | Implemented on this branch | Still required |
|---|---|---|
| P1 Free marketplace | Core catalog, seller registration, draft listing, moderator review, free entitlement, library and reference-only import to buyer workspace | Secure binary delivery, automatic Entity/World import, real end-to-end browser verification, complete integration tests, rights policy |
| P2 Creator assets | Reuse versioned library asset metadata and validated source reference checks; seller upload journey starts from existing Asset Library | Binary upload/object storage, antivirus/content scanning, format processing, real GLB preview, automatic compatibility certification, protected downloads |
| P3 Paid commerce | Separate non-game wallet order schema and explicit fail-closed checkout API | Payment provider, verified webhooks, idempotent settlement, double-entry records, taxes, payouts, refunds, legal approvals |
| P4 Player trading | Trade-offer record model, transfer eligibility policy, fail-closed offer endpoint | Authoritative in-game item ownership, trade locks/escrow, atomic transfer, rollback, dispute handling, anti-duplication and launch review |

**No paid sale, payout, virtual item transfer, public file upload, or automatic game compatibility is claimed or enabled.**

## Source of truth and constraints

- Work is based on the existing Next 16 / React 19 / Prisma 7 repository.
- Private workspace assets are not implicitly public: listings reference a fixed asset version, and only a separate explicit publication flow can expose marketplace metadata.
- Only `ORIGINAL` provenance and `VALIDATED` / `RUNTIME_READY` existing assets can be submitted. Moderator permission is an independently, manually provisioned `MarketModeratorGrant.isActive`; workspace owners cannot self-approve.
- No seller may set `verified` or `transferable` in an API request.
- Free acquisitions create nontransferable user entitlements. They do not grant resale rights or allow accessing the source creator workspace. The buyer may import the pinned source *reference* into an authorized workspace Asset Library. This is not secure binary delivery, file hosting, or verified game compatibility.
- Paid checkout is **disabled in server code**; SVC and GFC remain fictional, noncash and separate.
- Secondary transfer is **disabled in server code**. No speculative wallet, currency conversion, cryptocurrency or synthetic property ownership.
- Product cards use category art placeholders rather than pretending production imagery/3D preview is already available.
- This schema is additive. Do not run `db push` / migrations against production or valuable data without backups and approval.

## To verify on a disposable development database

1. `npm ci`.
2. Set local disposable `DATABASE_URL` and `SESSION_SECRET`; do not reuse production values.
3. `npx prisma validate`, `npm run db:generate` and `npm run db:push` **only to the disposable DB**.
4. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
5. Sign in as a creator with `asset.manage`; create a store and draft listing from an original validated asset with source reference.
6. Independently provision a moderator grant on disposable DB only; with a different user review and publish listing.
7. Acquire it with a separate signed-in buyer; verify one entitlement after repeated clicks; verify another account cannot read it.
8. Confirm draft listings are not visible publicly; cross-workspace asset IDs cannot be listed. Import an acquired asset to the buyer's workspace and verify the licensed metadata and idempotent import mapping.
9. Confirm `checkout` and `trade-offer` return safe disabled errors and do not write financial or transfer records.
10. Review 390/768/1024/1440px responsive layouts and assistive technologies.

## Release blockers

**Do not merge as production-ready.** Complete payment and intellectual property legal policy, seller verification, secure asset upload/delivery, provider integration and audit/security reviews before enabling paid or trading phases. Public catalog and acquisition flow require independent QA and production storage planning.

## Suggested next implementation checkpoint

Complete protected GLB upload + thumbnail + buyer-entitled download with a chosen object-storage provider, then a real `Add to Entity` destination. The current reference import is not a substitute for protected binary transfer. Follow with end-to-end role/cross-tenant tests. Only once that flow is proven should P3 payment-provider work begin.


## Continuation checkpoint: private 3D model pilot (29 October 2026)

The marketplace implementation now also includes:

- Seller-only private GLB v2 upload form and POST /api/marketplace/files. Files must be <= 20 MB, self-contained, and have valid GLB JSON structure. Only original 3D production assets can be uploaded.
- Configurable mounted filesystem via SIMVERSE_MARKETPLACE_STORAGE_DIR, which must be an absolute private persistent storage path. No serverless ephemeral storage or public-folder writes.
- A SHA-256 integrity record and uniquely named private model file; uploaded assets gain a new versioned reference in the existing Asset Library.
- Authenticated GET /api/marketplace/files/[fileId] checks creator workspace rights, independent moderator rights, or buyer rights to the exact pinned asset version. Otherwise files are not served.
- The buyer's My Library page can display a real Three.js GLB viewer for eligible acquired model references. Nonbuyers do not receive raw private models.
- Marketplace GLB parsing and marketplace integration test suites. Navigation test expectation updated for the new eighth section.

**Boundaries:** This is a storage and preview *pilot*, not production-grade binary distribution. No malware scan, safe public GLB derivative preview, cross-instance object-storage replication, thumbnail processor, production CDN, file quarantine workflow, copyright certification, or automatic Entity/World compatibility is implemented. The full acquisition flow still requires browser/device QA. Payments, paid fulfillment, payouts and trading remain disabled. The earlier phase-status table must be read together with this newer checkpoint.

### Local pilot test path

1. Start from a *disposable test database* and separately configured persistent private directory. Never apply schema or clean files in production without review and backup.
2. Create an original 3D asset in the private Asset Library.
3. Seller opens Marketplace > Sell, uploads GLB, then validates the new version through the established production status workflow.
4. Seller creates free listing and submits for independent moderator review.
5. Moderator inspects the source and publishes, buyer gets the free item and previews it in My Library.
6. Buyer imports the licensed reference into an authorized workspace; permission-gated reads should work only for the original creator and licensed buyer.
7. Verify direct file read without an ACTIVE entitlement returns 404; content hash mismatch is rejected; no payment or trade endpoints fulfill.

### Additional production gates

A durable cloud object-storage provider, malware scanning, asynchronous optimization pipeline, immutable binary retention, seller verification, and merchant/consumer policies are still mandatory for public commercial release. Local mounted-volume pilot files are not suitable for stateless production deployment.


## Continuation checkpoint — licensed Entity and World linkage

The buyer library now supports two explicit, permission-checked destinations:

1. **Use in Entity**: Select an existing Entity in your active workspace. Requires `entity.edit` and a valid ACTIVE entitlement to a GLB. The action imports the nonresellable reference if needed and sets the Entity visual profile to the selected model. It deliberately replaces only the visual model, not stats, AI, animation mappings, controls, or gameplay. Repeating the same assignment does not produce new visual-profile revisions.
2. **Add to World**: Select an existing editable World. Requires `world.manage` and an ACTIVE entitlement. The action imports the source reference if needed and pins the current imported asset version in the World asset-association list. Repeating the action does not append duplicate associations or World versions. This is **not** automatic visible scene placement or runtime animation.

The private Marketplace file route has a narrowly allowlisted model URL exception in the existing Entity visual-profile schema so a licensed buyer can preview or use the GLB. The file route still checks the signed-in user's license or workspace/moderator rights. Team members and public viewers without their own entitlements cannot silently fetch the binary. **Do not claim team-wide or public-world use without workspace and runtime licensing/access work.**

The buyer Library now offers manual 3D preview activation rather than mounting every WebGL canvas at once. Placement and model-reference contract tests were added for the destination integrations.

### Required QA

- Buyer A buys the GLB; User B does not. Verify B cannot attach or read the model via guessed identifiers.
- Buyer A selects an Entity and sees a private visual-preview model when logged in. Ensure prior appearance is replaced without altering Entity gameplay settings.
- Buyer A selects a World. Verify a new World version records a single asset association and the second click is idempotent; no visible-placement claim should appear.
- Validate foreign-workspace Entity/World IDs are rejected and archived destinations remain protected.
- Repeat with a private `/api/marketplace/files/<32-hex-id>` reference from the private-upload pilot.
- Test actual browser loading, animation behavior, responsive control layout and license-bound access before any public release.

**Commerce:** Payments, payouts and player-to-player trading still remain completely disabled.


## Continuation checkpoint: World Layout Studio with rendered models

- World detail now links to `/worlds/[worldId]/layout`, an interactive client-side Three.js layout editor. The page is workspace-scoped and shows only model URLs that the current user is entitled to access; a colleague without a buyer entitlement sees an honest placeholder instead.
- Saved World asset associations are rendered at their existing metric X/Y/Z coordinates. For licensed GLB sources that the user can load, the real 3D geometry appears; otherwise the UI displays clearly labelled placeholder blocks. The studio supports orbit/zoom, click-to-select, numeric position/rotation/scale controls, and discard/save.
- `/api/worlds/[worldId]/layout` provides authorized read and placement-only PATCH operations. The server checks World permissions, status, expected World version, complete association identifiers, licenses and existing World bounds. Edits preserve the rest of the World blueprint and create a new immutable World version. Cross-workspace reads/edits are blocked.
- The new tests verify persistence, version checks, invalid IDs, out-of-bounds coordinates and that importing a marketplace model does not reveal its URL to another workspace member without an active entitlement.

**Scope:** This is a genuine interactive *World layout preview/editor*, not the main in-world runtime. It does **not** yet add collision/physics, 3D terrain generation, animation, persistent NPCs, game mechanics, robust renderer optimization, client mesh instancing or drag handles. Objects beyond the first 60 have editable coordinate records but are excluded from this prototype 3D preview. A model may still fail to load in a particular browser and will then remain a placeholder. Commercial payments and player trading remain off.

### QA checklist

1. From an authorized buyer account, acquire a real creator GLB, add it to a World, then open **World → 3D Layout**.
2. Confirm real model geometry renders rather than only a placeholder. Move the lion's X/Z position, change yaw and size; save, reload and verify the persisted layout/new World version.
3. With a different user lacking the entitlement, verify the private GLB is inaccessible, no model URL is leaked by the layout read response, and the editor displays a placeholder.
4. Test invalid coordinates, missing associations, stale version, archived World and foreign-workspace target.
5. Check Firefox/Chromium, mobile, WebGL-disabled fallback, and large source models before production.
