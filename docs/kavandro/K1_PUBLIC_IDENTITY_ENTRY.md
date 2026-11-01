# KAVANDRO K1 — Public Identity and Citizen Entry

**Status:** K1 public branding and guided onboarding implemented on `feature/kavandro-k1-brand-entry`, awaiting CI, manual browser QA and merge review.

## Applied

- Central public brand constants in `src/lib/brand.ts`.
- Shared wordmark displays KAVANDRO in the primary public site and app shell.
- Landing page metadata, primary join CTA, footer and preview messaging use KAVANDRO.
- Default app branding in `.env.example` and environment parser updated (existing private `.env` files are **not** edited).
- Citizen dashboard welcome and initial civilization screen identify KAVANDRO.
- Root document metadata describes the civic product, not a creator-first simulation product.
- New signed-in `/welcome` journey reads saved username and founding-country preference; no citizenship writes.
- New registrations (without a saved destination/legacy Earth intent) continue to `/welcome`; existing redirected flows are preserved.
- Dashboard includes an accessible `My founding journey` entry.

## Intentionally preserved

- Database records, SQLite files, login/session data, original `SV-` identifier, email/password, rights, badges, third-party integrations and legacy URLs.
- Existing SIMVERSE references within historical documents, identity ledger labels, older creator tools, simulation products, database names and safety notices.
- Geographic country drafts stay **unpublished**. Citizenship issuance, district activation, Vascoin rewards/contributions, construction, land ownership and 3D release remain subject to current server-side gates.
- This is **not** a worldwide database rename or a promise of a deployable brand/trademark.

## Verify in a disposable environment

1. Sign in as a test user; check wordmark and browser title on home/dashboard.
2. Public register/login links work; existing registered identities remain unchanged.
3. My Civilization preference and application draft still work while unpublished countries can't grant citizenship.
4. Test old `/earth`, `/planet`, `/social`, `/profile`, creator links and separate economy tools for regressions.
5. TypeScript, ESLint, unit/integration tests and production build pass against a disposable DB.
6. Responsive mobile screenshots, accessibility, and privacy/security checks are still required before production.

## K1 follow-up slices

- Polish first-run citizen experience after testing /welcome and registration redirects on mobile and verified-email flows.
- Explicit accepted identity and country/district application policy; legal approval for permanent branding before public promotion.

**Safety:** no real database migration, deployment or source deletion in this slice.
