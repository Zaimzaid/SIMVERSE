# SIMVERSE Team & Settings functional upgrade

Branch: `feature/team-settings-functional-v1` (not automatically deployed).

## Delivered
- Workspace invitations: 7-day expiry, email-bound single-use tokens (only SHA-256 digest persisted), revocation, invite preview, acceptance on login/registration, audit entries.
- Invitation delivery: copyable private link always; optional email via Resend when `RESEND_API_KEY` and `SIMVERSE_INVITE_FROM` are set on the server. Without email configuration **no email is sent**.
- Members: view, role change, removal; owner cannot be demoted or removed; administrators cannot manage other administrators or assign administrator roles.
- Recent workspace audit history, only visible to users with team-management permission.
- Workspace preferences: rename, change public logo URL, create an additional private workspace, switch memberships; corrects a bug clearing logos when only renaming.
- Account: change password (invalidates all other sessions), list/revoke remote sessions, toggle storage of social activity alerts.
- Player profile privacy remains managed from `/profile`, not duplicated as an unenforced settings toggle.

## Deployment checklist
1. Back up your production database before schema changes. Do **not** run the test reset helpers on real data.
2. Configure DATABASE_URL, SESSION_SECRET, APP_URL. APP_URL must be the actual public address used in invitation links.
3. Run `npm ci`, `npx prisma db push` (or create a reviewed migration), and `npm run db:generate` before build. This adds WorkspaceInvitation and User.socialAlertsEnabled without deleting existing data.
4. Optional: configure verified Resend sender and API key. If absent, copy/share invite links manually.
5. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Perform browser QA on Team, Settings, join invitations, multi-account access, expired and revoked tokens.
6. Test in isolated development database and browsers before merging to production.

## Known limitations / future phases
- No native file upload for workspace logos or profile pictures (uses image URL).
- Two-factor authentication, cloud account connectors, verified-email registration and safe account deletion are not included.
- No custom per-user permission override, project-specific roles/assignments, bulk invitations or employee scheduling.
- No email notification settings beyond the optional invite-email delivery provider; social alerts setting affects stored in-app social notifications, not delivery of messages/calls.
- Audit history covers only actions already integrated with the audit service; it is not comprehensive surveillance or productivity measurement.
- No production pentest or browser acceptance is claimed.
