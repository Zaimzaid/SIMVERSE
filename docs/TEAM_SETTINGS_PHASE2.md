# SIMVERSE Team & Settings Phase 2 — security + images

**Source branch:** `feature/team-settings-phase2-security` built on `feature/team-settings-functional-v1` (#28); merge Phase 1 before Phase 2.

## Implemented in this branch
- Authenticator-app TOTP (RFC 6238) with 30-second codes, AES-256-GCM encrypted secrets, enrollment verified by a valid code, short-lived login challenges limited to five attempts, eight one-use recovery codes, password+code required to disable, and invalidation of other sessions when enabling/disabling.
- Optional verified-email registration. Set `SIMVERSE_REQUIRE_EMAIL_VERIFICATION=true` ONLY after provisioning `RESEND_API_KEY`, a verified `SIMVERSE_INVITE_FROM` and the real `APP_URL`. New registrations cannot access SIMVERSE until email verification. Existing accounts continue to function without retroactive verification.
- Small direct image uploads (PNG/JPEG/WebP, max 600 KB) for profile avatars and workspace logos stored within the existing database, served with `nosniff`, immutable caching and restrictive response CSP. Images are public via their opaque URLs. This is a starter pipeline, NOT a large-scale cloud/CDN.
- Validation, tests and strict server-side permission checks retained.

## Deployment and security cautions
- **Back up the database** and review schema changes before `prisma db push`. Do not point Vitest/test reset at a real database.
- `SESSION_SECRET` is also used as key material for encrypted TOTP secrets/recovery-code hashing: rotating it without a controlled migration makes existing enrolled 2FA unusable. Back it up using a secret manager; do not commit it.
- Never log full authenticator secrets, invitation links, email verification links, recovery codes or raw upload bytes.
- Rate-limit auth endpoints at the edge before internet deployment; per-challenge attempt caps are not a substitute for global abuse throttling.
- Provide a real HTTPS `APP_URL` and configure sender domain before enabling verification.
- During browser QA test 2FA login with correct/wrong/recovery code, invitation onboarding with verified-email mode, and upload previews across two browser sessions.
- On a multi-server production deployment, use durable storage/object storage and audited retention/deletion policies; SQLite inline images are not a long-term media strategy.

## Outstanding and intentionally not claimed
- Verified-email requirement is opt-in, not enabled by default.
- QR image is not generated; authenticator setup uses a standard Base32 key/otpauth URI.
- Account deletion/export, cloud OAuth connectors, granular custom per-member permissions and project-specific permission isolation still need separate threat modeling and schema review.
- No manual browser acceptance, independent security audit or penetration testing has been completed.
