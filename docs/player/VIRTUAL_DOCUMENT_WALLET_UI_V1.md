# SIMVERSE — Virtual ID Cards and Passport Booklets (UI V1)

## Player experience
This phase redesigns **/profile/documents** as a personal virtual
document wallet. It does not create or mimic any government-issued document,
and no SIMVERSE records can be used for real identity verification, border
crossing, nationality, employment authorization or immigration.

### 1. Player ID (non-citizenship)
- A user has an immutable `SV-…` player number in the existing identity
  system. After saving a username, a read-only, plastic-inspired
  **Virtual Player ID Card** displays their profile name, username, number,
  profile avatar (or initials), issue date and card expiry.
- Player card issuance date is the stored `PlayerIdentity.createdAt`.
  The illustrative card's expiry date is exactly **three years after
  identity creation**. This is a visual pilot policy, computed from the
  persisted date; it does **not** expire the permanent SIMVERSE ID.
  Renewal is not available in this phase.
- It does **not** indicate national/country citizenship or identity
  validation by a government.

### 2. Approved citizenship and travel documents
- Country citizenship must still be applied for and independently
  approved; submitting a form never automatically creates citizenship.
- The approved `CITIZENSHIP` application now generates
  `PlayerVirtualDocument` with a unique `SVV-…` document serial,
  `issuedAt` and `expiresAt`, **in the same transaction as the
  independent review and citizenship ledger entry**.
- National and international virtual passports, and virtual residency
  permits, already had issued/expiry fields in the database. Their
  read-only visual appearance is newly upgraded:
  - Citizenship and residency: collectible game-world plastic ID card.
  - National and international virtual passports: decorative game-world
    booklet cover plus readable data card, with original colors and branding.
- Both kinds show **player name, username, SIMVERSE ID, virtual country,
  issue date, expiry date, unique reference number and status**.
- Pilot country-document validity is still **one year from authorized
  issuance**, preserved from the original `pilotDocumentExpiry()`
  policy. Citizenship ledger membership remains separate from expiry
  of its visual card. Renewal/revocation actions need a separate phase.
- Expired or revoked documents display prominent EXPIRED or REVOKED labels.
  A past expiration is never hidden by the original issue-time VALID flag.
- Pending/denied applications are visible only in the application history
  and **never rendered as issued country documents**.

### 3. Privacy and trust boundary
- `/profile/documents` and `GET /api/player-documents/applications`
  remain session-protected and scoped to the signed-in user's
  `PlayerIdentity`.
- Public `/u/[username]` profiles do not include any document numbers or
  wallet records. No credential-sharing, public verification, QR, MRZ,
  realistic authority seal, downloaded ID template or self-issuance API.
- Country reviewer grants, scope, self-review checks, residency and
  active-citizenship prerequisites are unchanged.
- Labels on every visual document explicitly state
  **SIMVERSE FICTIONAL / NOT GOVERNMENT ID / NOT REAL PASSPORT**.
- User-supplied existing avatar URL is used only as the in-world portrait.

## Existing data and migration note
No schema migration is required. Older approved citizenship applications
created before this UI change may have citizenship ledger rows but **no
`PlayerVirtualDocument` row** because the former review handler did not
create one. The UI honestly shows a historical credential-record warning.
A separately audited, operator-authorized backfill will be required if
those old approvals should receive cards—do not synthesize, self-issue or
backdate a verified-looking document on a player GET request.

## Verification
- Integration tests assert citizenship submission remains PENDING_REVIEW
  with no document; independent approved review issues exactly one dated
  citizenship ID and conserves all existing passport issuance rules.
- Component render tests verify player ID and both passport views,
  issue/expiry dates, expired/revoked statuses and absence of issued
  credential UI for pending/denied country applications.
- CI runs Prisma database, TypeScript, ESLint, Vitest and Next build.
- Manual QA required: player profile save -> player ID card;
  verified reviewer -> citizenship card -> national/international
  passport applications -> passport booklets; light/dark layouts,
  390px mobile view, screen reader labels and safe access isolation.

## Development location
Draft PR stacked on UI navigation redesign PR #17
(`feature/platform-navigation-redesign-v1`). This includes previously
developed identity/document/immigration systems and is independent of
the Marina Junction V0.2 3D branch.
