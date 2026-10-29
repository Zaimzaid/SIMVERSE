# SIMVERSE Messaging M1 — Live Delivery and Reconnection Pilot

**Status:** code on `feature/messaging-m1-realtime-recovery-20261029`, stacked on M0 PR #30; browser/device QA and production migration are **not** complete.
**Rollout:** staged demo only; do not merge or deploy without owner review.
**No changes to `master` and no production database operations.**

## Implemented in this pilot

- **Retry-safe 1:1 sends.** Modern clients attach a UUID `clientId` per send. The server persists it with a unique index on `(senderId, clientId)`. A repeat with the same sender, ID and payload returns the original record; conflicting payloads are rejected. Legacy senders without the optional key continue working.
- **Receiver-confirmed delivery state.** Inbox responses include up to 100 *authorized* incoming, unacknowledged IDs. The browser POSTs those IDs to `/api/social/delivery`; server requires the authenticated receiver and changes `deliveredAt` only once. Sender sees **Sent**, **Delivered** or **Read** (read is tracked when the conversation opens).
- **Cross-worker live invalidation.** An authenticated `GET /api/social/events` Server-Sent Events stream compares small persisted activity markers every 2 seconds, never sends chat contents, and emits a generic `sync` event. Each connection closes after about 25 seconds; browser EventSource reconnects automatically. Friendships, notifications, direct messages and receipt changes trigger refresh. Full data still travels through existing authorized JSON APIs.
- **Fallback synchronization.** The Community UI continues 15-second refresh while visible and resynchronizes when the tab becomes active; loaded older history survives refetch. The user can retry a failed send without producing an extra message if the first request already reached the server.
- **UI:** low-friction connection status and Sent/Delivered/Read labels. The approved compact Community navigation is preserved.

## Real limits

This is **not** a horizontally optimized WebSocket, Redis pub/sub or commercial push service. Every open stream checks the database several times per second/minute, so this design is appropriate only for a small controlled pilot. Real load testing and hosted-platform support for streaming must be verified before scale. SSE does **not** deliver push notifications when the app is closed. No encrypted local offline queue is provided: a failed message remains in the current composer for retry. A browser refresh may lose an unsent draft. `Read` means the conversation was fetched, not confirmed visually rendered. Group chat does not have the direct-message delivery state. SSE does not contain plaintext messages or notifications, but application messages are **not end-to-end encrypted**.

## Database change and data preservation

New nullable columns on existing `SocialMessage` rows: `clientId` and `deliveredAt`. New unique/index constraints on direct messages. Existing message rows are not modified or deleted.

**Do NOT point `prisma db push` or integration-test helpers at a valuable SQLite file.** CI uses a disposable database. The repository does not have a complete historical Prisma migrations baseline. Before any existing-data environment is updated: back up and verify restore; rehearse the additive SQLite DDL on a cloned database; inspect the existing indexes, including their exact names; plan an approved schema migration, maintenance window and rollback.

Proposed SQLite SQL for an operator to review (do not run blindly on production):

```sql
ALTER TABLE "SocialMessage" ADD COLUMN "clientId" TEXT;
ALTER TABLE "SocialMessage" ADD COLUMN "deliveredAt" DATETIME;
CREATE UNIQUE INDEX "SocialMessage_senderId_clientId_key"
  ON "SocialMessage"("senderId", "clientId");
CREATE INDEX "SocialMessage_recipientId_deliveredAt_createdAt_idx"
  ON "SocialMessage"("recipientId", "deliveredAt", "createdAt");
```

## CI gates

Use GitHub Actions on a **disposable** SQLite database: `npm ci`, `npm run db:push`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

Service tests cover matching/conflicting idempotency keys, legacy sends, explicit delivery receipts restricted to the recipient, replay acknowledgments and activity-marker changes.

## Later manual tests (owner deferred visual testing)

1. Open two separate logged-in accounts on different browsers. Send a message: sender initially sees Sent. Recipient's active Community page should acknowledge inbox receipt, making the sender see Delivered without opening that chat. Open the conversation to make it Read.
2. Disconnect recipient's network, send a message, reconnect and verify it appears once with correct statuses. Simulate a lost POST response and retry the same client ID; database must contain only one message.
3. Suspend a tab or temporarily prevent SSE connections; the 15-second fallback must still refresh the inbox. Resume the tab and verify reconnect/resync.
4. Check friend requests, group invites, blocked-user rules and loaded older-message pagination from M0; test on narrow mobile devices.
5. Check non-friends and blocked users cannot send; outsider cannot acknowledge another user's message IDs. Test chat access after sign-out.
6. Benchmark concurrent SSE connections and query load before choosing a commercial transport.

**Acceptance:** No code should be labeled production-ready from CI alone. M0 approval and a safe schema migration are required before M1 is merged or deployed.
