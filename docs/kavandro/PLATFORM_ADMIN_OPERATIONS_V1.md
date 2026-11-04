# KAVANDRO platform administration — V1

This console is a **platform-wide** internal administration layer, separate from workspace ownership and district stewardship. It is not a simulation or mock dashboard.

## What is implemented

- `/admin`: live counts of registered users, unexpired login sessions, workspaces, active admins, audit records and pending admin invitations.
- Activity feed: category filters, 30-row pagination, manually triggered refresh, optional 30-second auto-refresh, and authenticated CSV export (most recent 5,000 matching records).
- Citizen directory: account name/email, verification status, workspace membership counts, search and pagination.
- Workspace registry: owner, member counts and creation dates, with pagination.
- Civilization/security views: filtered events from the existing audit ledger.
- Admin staff: owner/admin managed invitations, role changes, deny-only per-section visibility, immediate deactivation/re-activation and invitation revocation.
- Google Authenticator or any compatible TOTP app: six-digit code to accept the invite and a separate current-code step-up to open the admin console. Step-up expires after 60 minutes and is cryptographically bound to the ordinary login session.

## Invite lifecycle

1. A verified OWNER or an ADMIN with access to the staff section enters a recipient email, selects a role and chooses visible dashboard sections.
2. A random 256-bit single-use token is generated. Only its SHA-256 digest is stored, not the usable link.
3. The URL is delivered through the configured Resend integration, or shown once for manual secure sharing. It expires after 24 hours if unused.
4. The recipient must sign in or create an account using the exact invited email, enable account TOTP under Settings (if not already enabled), and type a valid current authenticator code.
5. On successful acceptance, the invitation is **atomically deleted** and staff access is granted. The link becomes invalid immediately (stronger than leaving it active for a one-minute grace period).
6. The staff member can visit `/admin` via the regular dashboard's **Administration** shortcut. Their server-side sections are restricted by role and individual denials.

Invitations never grant OWNER. Only the separately provisioned platform owner can grant ADMIN. ADMIN cannot edit an ADMIN, OWNER or their own record. Ordinary workspace OWNER/ADMIN roles confer no global platform access.

## First-time setup (trusted server operator only)

1. Run `npm ci` and `npm run db:generate`.
2. Back up the current database. Run `npm run db:push` to apply the new Prisma models. Never apply a development database reset to a real database.
3. Set `DATABASE_URL`, `SESSION_SECRET` (stable 32+ characters) and `APP_URL` to the deployed site's **HTTPS** public origin.
4. Create a normal KAVANDRO account for the trusted initial owner, then open Settings and enable two-factor authentication with Google Authenticator. Confirm the code to activate it.
5. On the trusted server, run `node scripts/bootstrap-platform-admin.mjs owner@example.com`, replacing the placeholder with the actual account email. This script requires an existing account with enabled TOTP and refuses to create a second owner.
6. Log in to the platform, open **Administration** (or `/admin/access`), and verify with a fresh authenticator code.
7. Optional email delivery: configure `RESEND_API_KEY` and `SIMVERSE_INVITE_FROM`, using a verified sender. If unavailable, copy the generated one-time link and share it privately.

Never commit production `.env`, TOTP setup secrets, invite URLs, or recovery codes to Git.

## Test checklist

- Owner can invite VIEWER/MODERATOR/ANALYST/ADMIN; non-owner ADMIN cannot invite another ADMIN.
- Invite accepted only with the invited account, active TOTP, and current six-digit code.
- Wrong code, email mismatch, revoked/expired/used link all fail.
- Accepted link immediately stops working, even with a second concurrent request.
- A person excluded from Citizens cannot fetch Citizens data; front-end hiding is insufficient.
- Deactivating a staff member blocks existing admin access on their next request.
- A workspace owner without platform staff access receives no global-admin rights.
- Login session expiry/logout invalidates the admin gate. The separate gate expires within one hour.
- Refresh, filters, search, pagination, CSV export, copy link, invite/revoke, role changes and section toggles have working handlers.

Run: `npm run typecheck && npm run lint && npm run test && npm run build`.

## V2 monitoring expansion (pending deployment)

- Seven UTC-day trend snapshots show recorded audit events, registrations, district-club posts and challenge attempts without exposing private message bodies.
- Operational review backlog shows open club reports, open assembly reports and pending proposal moderation.
- Security signals show failed administrator authenticator-code attempts and account 2FA disable events over the last 24 hours. These are counts, not proof of a security incident.
- Audit history is filtered by action family and time range (24 hours, 7 days, 30 days or all). CSV export uses the same date/category filters, capped to 5,000 rows.
- Activity monitoring is based on events already emitted by the application and database status counts; it does not capture every interaction. Trend aggregation issues separate count queries per UTC day, which should be optimized or cached before high-traffic use.
- Open moderation counts are visibility-only. This change does **not** grant extra power to read private report content, remove accounts, moderate messages or alter finances.

## Boundaries and production cautions

- **Activity coverage:** This dashboard displays existing instrumented audit events, not *all* passive reads, page views, mouse clicks, or every direct message. Additional event producers must be deliberately added for broader coverage, with privacy/retention rules.
- **Online now:** The login-session total counts unexpired sessions, not realtime presence.
- **Brute-force protection:** Admin-code attempts have a five-per-15-minute *in-process* limiter. Before multi-instance deployment, replace this with an atomic distributed store (for example Redis). The ordinary login limiter has the same current single-process limitation.
- **Separation of duties:** Platform staff cannot impersonate users or arbitrarily modify private user data from this V1 monitoring console; destructive moderation tools need separate policy, approval and auditing.
- **Operations:** Test the new schema against a disposable/staging copy before deploying. Preserve database backups and monitor logs. No credentials are shipped with the code.
