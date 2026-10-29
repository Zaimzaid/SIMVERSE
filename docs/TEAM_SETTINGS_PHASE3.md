# SIMVERSE — Team & Settings Phase 3

**Branch:** `feature/team-settings-phase3-collaboration`
**Dependency:** phase 1 PR #28 and phase 2 PR #29 must be integrated in order before Phase 3.

## Shipped to development branch
### Member access overrides
- Owner may **deny** individual permissions that a member's base role grants.
- Server `requireMembership` computes effective grants from role minus denied permissions. The platform navigation context uses the same effective grants.
- No per-user grants beyond the assigned role; no OWNER restrictions or owner self-lockout.
- The UI includes a compact "Access" panel for the owner on Team.

### Project assignments
- Each project can assign existing workspace members as LEAD, CONTRIBUTOR, REVIEWER or OBSERVER and attach a short responsibility note.
- Assignments are workspace-scoped, capped at 100, auditable, and automatically removed when a project/member is removed.
- Project detail has a Team tab with add, update and remove.
- **Important security boundary:** These are *responsibility assignments, not exclusive private project access*. SIMVERSE currently has many independent simulation, entity, world and asset API routes that still authorize by workspace role. We deliberately do **not** label projects private or claim full project-level isolation without auditing those routes.

### Account data and deletion requests
- `/api/account/export` downloads a no-cache JSON account snapshot containing account details, player identity, workspace memberships, authored project/world/asset/simulation summaries, social direct messages and friendships. It omits password hashes and 2FA keys. It is **not** a complete simulation media backup nor a comprehensive regulatory data export.
- Settings lets the signed-in person create/cancel a password-confirmed account deletion **request**, with explicit text confirmation. A request does not delete the account or transfer owned workspace content. Actual deletion needs a documented, audited ownership/content-retention workflow; no hidden cascade.
- Existing data is preserved.

## Verification
`npm ci`, `npx prisma db push` on a disposable database, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Complete manual browser tests before merging.

## Remaining major features
- Full project-level permission isolation across all linked data, asset and simulation APIs.
- Production cloud storage OAuth: Google Drive, OneDrive, Dropbox or S3; provider apps and verified redirect URIs required. No fake "connected" state or cloud backup claims.
- A real, safe, auditable account-deletion/ownership-transfer processor, data retention policy and complete data export.
- Owner-to-owner ownership transfer and advanced staff approvals.
