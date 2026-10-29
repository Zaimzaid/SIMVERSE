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
