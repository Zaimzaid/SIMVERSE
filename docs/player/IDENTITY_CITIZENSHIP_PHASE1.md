# SIMVERSE Player Identity & Citizenship — Phase 1

## Delivered code
This branch is an independent identity feature stacked on the existing Earth
map navigation work, **not** on paused 3D work. Phase 1 deliberately covers
accounts, public/private player identity, fictional home-country preference
and a database foundation for future fictional citizenship.

### Features
- Immutable SIMVERSE-only identity number, random 96-bit ID, created during
  signup and lazily provisioned for accounts created before Phase 1.
- Unique, normalized lowercase username; 3–24 chars, reserved words blocked,
  database-level unique index, duplicate conflict handling.
- Same player account supports PLAYER, CREATOR, or BOTH preferences independently
  of workspace roles and all privileged actions.
- Profile fields: display name, HTTPS avatar, HTTPS banner, optional creator
  name, biography, public/private visibility (PRIVATE default).
- `/profile`: authenticated personal identity editing with the immutable ID,
  citizenship notice, private email and home country choice.
- `/u/[username]`: anonymous-friendly public presentation accessible only
  for PUBLIC profiles; excludes email, simverseId, personal citizenship entries,
  team roles and other private information.
- `GET/PATCH /api/player-identity`: session-bound authenticated endpoints.
  The PATCH input rejects extra fields (e.g. spoofed citizenship grants).
- Home country must refer to a supported sourced country in an ACTIVE Earth
  catalog version. This is a user-selected *world preference*, not real
  nationality or verified/approved SIMVERSE citizenship.
- `PlayerCitizenship` is a separate ledger foundation. It contains **no**
  automatically approved citizenship; Phase 1 offers no self-service grant,
  passport issuance, visa approval, fake certificate or unverified travel right.
- Existing `/settings` user display name/avatar editing remains compatible.
- Existing `User` and `WorkspaceMember` security boundaries are unchanged.

### Data schema
`PlayerIdentity` is keyed by unique `userId`; `simverseId` is permanent and
unique. Its `homeCountryId` FK points to a sourced EarthGeoPlace record.
The `PlayerCitizenship` table separates future reviewed citizenship statuses
from profile preferences; it is keyed by `playerIdentityId` and
`countryPlaceId`. **No citizenship records are awarded in Phase 1.**

### Testing
GitHub Action `earth-application-validation.yml` already checks Prisma
development schema, TypeScript, ESLint, Vitest and Next production build on PR.
Validate on this branch; perform a manual login and confirm:
1. New user registers and receives exactly one unchanging SIMVERSE ID.
2. Existing user opening `/profile` creates one identity without duplicate IDs.
3. Reusing another person's username is rejected; case changes do not bypass.
4. Default is private; `/u/username` returns 404 until explicitly published.
5. Published profile shows permitted metadata, **never** email or SIMVERSE ID.
6. Selecting Nigeria (if sourced catalog is imported) updates home country
   without creating citizenship, passport, grants or other privileges.
7. Trying to PATCH extra `citizenship` or `isAdmin` keys is rejected.
8. Legacy Settings profile edits still update the top-bar display identity.
9. Make sure the profile form, country picker and public page look good on
   both desktop and mobile, and test missing WebGL is irrelevant.

### Deferred to later phases
- Real-world ID verification (not required; highly privacy-sensitive)
- Home citizenship qualifications and application/review process
- National and international *fictional* passports, visas and travel documents
- Residency, dual citizenship, naturalization, regional access policies
- Creator/Government Pass entitlements and special access
- Social/friends/followers and a published portfolio
- User image uploads/storage or in-world 3D avatars
- Profile completion scoring, achievements and profession history
- Migration beyond existing SQLite baseline into production PostgreSQL

### Important
This virtual SIMVERSE identity is not a real passport, real Nigerian
citizenship, an immigration service, proof of property ownership, or
government-issued documentation. Account identity, fictional citizenship
and actual permissions must remain separate.
