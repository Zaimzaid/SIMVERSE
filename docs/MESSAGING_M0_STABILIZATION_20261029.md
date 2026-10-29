# Messaging M0 — Reliability and access-control hardening

**Branch:** `feature/messaging-m0-reliability-hardening-20261029`  
**Starting point:** `master` at `088ec29e75af794a2eac57f31aae6522a5e4e0c9` (29 October 2026)  
**Scope:** This is an M0 stabilization patch, not realtime messaging, secure media uploads, or a production calling release.

## Changes

1. **Accurate direct-message read acknowledgments.** `listConversation` previously retrieved only the newest 100 messages but acknowledged *every* older unread message from that sender. The service now acknowledges only the returned IDs and orders equal-timestamp messages deterministically. Older messages remain unread until retrieved through the new authorized cursor-paging API and the **Load earlier messages** control; polling retains already-loaded history.
2. **Accessible long conversation history.** Direct chats can load older pages by an authenticated cursor validated against the current friendship; the browser retains loaded pages when polling for new messages.
3. **Accurate unread notification badge.** The notification feed remains a 60-item preview, but its unread total is now calculated independently over all unread records.
4. **Blocked participant visibility in groups.** Group message responses no longer include reactions authored by blocked users; an authenticated group member also cannot react through the API to a message from a user they have blocked or who has blocked them.

## Regression coverage

- Seed 105 direct messages and verify fetching 100 leaves exactly five earlier messages unread; paging retrieves and acknowledges those five; unrelated message IDs are rejected as cursors.
- Seed 75 unread notifications; verify preview length 60, unread badge 75 and mark-all-read resets count.
- Create a three-member group; block a member; verify their group message and reactions are hidden and direct API reaction to the hidden message is rejected.

## Validation and release conditions

**Do not merge without review.** Execute the repository's pull-request CI (Node 24, disposable SQLite schema, TypeScript, ESLint, Vitest and production build), then two-browser QA with separate signed-in accounts.

Check direct unread counts before and after opening a conversation; verify groups still load, permitted reactions continue to work and blocked-user content is not exposed. Confirm no migration or data reset is performed against live user data.

**Not included:** group-message pagination, realtime sockets, push notifications, E2E encryption, online presence, uploads, TURN relay, group moderation or full 3D chat.

## Manual QA

1. Login as two test accounts and complete friendship acceptance.
2. Exchange messages from both accounts, refresh, and verify history and unread badges.
3. With a seeded conversation exceeding 100 unread messages, open the conversation, select **Load earlier messages**, and confirm the older messages appear and the unread count eventually reaches zero. Polling must not erase loaded history.
4. Populate more than 60 unread alerts and verify the badge displays the correct total.
5. Create a test group with three friends, have two participants block one another, and confirm hidden messages cannot receive reactions through their IDs.
6. Confirm the chat UI on desktop and a narrow phone viewport; keep the previously approved compact navigation.

**Reporting labels:** source committed != automated CI passed != browser QA passed != approved to merge != deployed.
