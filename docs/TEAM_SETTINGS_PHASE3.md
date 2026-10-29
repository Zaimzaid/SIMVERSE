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

### Personal Google Drive connection
- Optional Google Drive integration using server-side Google OAuth authorization code flow, per-session single-use 10-minute state and encrypted access/refresh tokens. Requested scope is `drive.file` (files SIMVERSE creates/opens), not full Drive access.
- When connected, the user can manually upload their account snapshot as a JSON backup and disconnect later. Existing Drive files are not deleted when disconnecting.
- To enable: set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `APP_URL` and register exactly `{APP_URL}/api/account/cloud/google/callback` in Google Cloud's OAuth web-client redirect URIs. Enable Google Drive API, configure consent screen/test users and production app verification as applicable.
- Tokens depend on the existing `SESSION_SECRET` for AES-256-GCM encryption; rotating it without a planned migration invalidates existing connections.
- Client credentials are held on the server, never sent to the browser. Only the app-created JSON backup is uploaded. This is not a background sync, a complete workspace backup or a multi-provider connector.
- Live Google OAuth and actual upload require real Google credentials and user consent; CI only tests the protocol flow against mock endpoints.

## Remaining major features
- Full project-level permission isolation across all linked data, asset and simulation APIs.
- Additional cloud providers (OneDrive, Dropbox, S3), scheduled sync and full-world/asset backups require separate integrations and production credentials.
- A real, safe, auditable account-deletion/ownership-transfer processor, data retention policy and complete data export.
- Owner-to-owner ownership transfer and advanced staff approvals.
