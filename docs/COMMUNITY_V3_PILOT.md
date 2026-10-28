# SIMVERSE Community V3 — Focused Messaging + Remote-first Calls

**Branch:** `feature/community-v3-navigation-calls`
**Base:** `feature/social-animation-expansion-v2` (PR #25, which depends on V1 PR #24).
**Release gate:** draft pilot; no production deployment or merge before CI, laptop QA, and owner review.

## Implemented on this branch
- Replaces the crowded Community landing page with **six compact, equal-height section tabs**: Chats, Friends, Find Player, Requests, Groups and Alerts. All six remain visible without a horizontal scrollbar: 3 columns × 2 rows on phones/tablets, one 6-column row on desktop. The selected tab changes color but never changes size. Each tab switches the section displayed underneath.
- Shows **real database-backed pending friend request counts, inbox unread counts, group invitations and unread notifications**. The inbox list provides recent message previews and timestamps, with a server-side authorized friend list; no cross-account read access.
- **Recent conversations** now spans the full content width underneath the tiles, with real player names, previews and unread badges. Clicking **Friends** opens a separate directory; selecting a friend opens a full-width conversation with a Back button, text history, emoji reactions, the V2 media URL composer, and a sticky send composer.
- Call actions appear **in the conversation header (top right)**. Existing authenticated friend-only WebRTC signaling is retained.
- Incoming or outgoing call opens a full-screen modal. **Only the remote participant's camera is displayed**, never a self-preview. Mute/unmute, camera toggle, answer, decline and end-call buttons work with the local media tracks.
- `/social` now gets a focused, wider workspace area instead of a cramped right context rail.
- V2 group messaging, notifications and permission rules are reused; no schema changes or loss of existing accounts, friends or messages.

## Important limits — not implemented yet
- Inbox refreshes via 5-second polling; the open conversation refreshes via 4-second polling. **Not WebSockets**, instant guarantee, mobile push or background notifications.
- Last-message previews inspect a bounded recent-message window; unread totals are counted across the full inbox.
- Calling remains **one-to-one WebRTC with public STUN only**. TURN relay, robust cross-NAT connections, mobile wakeup, reconnect, group calling, call history, missed-call records and production moderation are not delivered.
- Media remains *external public HTTPS links*, not private uploaded attachments. Group chats retain V2 layout and are not yet fully redesigned to the direct-message level.
- No online presence, typing indicators, reply/edit/delete, direct uploads, voice notes or screenshot-proof acceptance.
- The animation studio remains the V2 2D and prototype 3D version. Animation refinements are tracked separately, not misrepresented as completed here.

## How to test safely on Windows
In a **new or disposable test checkout**:
```powershell
git fetch origin
git switch feature/community-v3-navigation-calls
npm ci
```
Keep the existing local `.env` for your **test** copy pointing only to its **test database**. V3 introduces no schema migration. Never run reset helpers / `npm run test` against a valuable SQLite database.

```powershell
npm run dev -- --port 3020
```
Open `http://localhost:3020/social` with **two accounts in separate browsers**. Set both usernames and profiles to PUBLIC under `/profile`.

### Manual QA scenarios
1. At 320px, 375px, 768px and desktop widths, verify equal-size compact tabs, 3-by-2 mobile/tablet and six-across desktop, no cut-off labels or horizontal scroll. Verify selected tab never grows larger than the other five. Change tabs and confirm the lower content switches without navigation away; test the selected tile state. Search an exact public username, request friendship, verify the Requests badge, accept, verify badge clears and Friends directory updates.
2. Open Chats to see the real recent-conversation list; confirm nothing is hardcoded from the design mock. Click Friends → choose friend → full-width conversation; use Back to return to recents. Send both directions, verify Chats badge and per-thread unread count, wait 4–5 seconds for new message while Community is open, and verify reopening marks read.
3. Send emojis and media links; verify group invitations and notifications stay in their own tabs and badge values reflect database state.
4. Click top-right phone icon and answer on the other browser; test mute and hangup. Repeat with the video icon; confirm only the **remote camera** is visible in the caller's view (local camera is not previewed).
5. Permission denial, blocked account, offline recipient, WebGL-disabled settings and narrow (375px) viewport: ensure errors and layout are understandable.
6. Verify existing `/animation`, `/animation/3d`, `/profile`, `/earth/neighborhood` still load.

## Next priorities
- Fix laptop QA defects and preserve permission rules.
- Add real-time WebSocket/WebTransport chat via an authenticated transport; delivery/read acknowledgments and reconnect behavior.
- Separate group conversation UX, group admins and invitation moderation, conversation search/mute, secure uploads.
- Production calls with TURN, call history/missed call, audio route switching and reliability tests; **do not claim production calling now**.

**Integration note:** This PR is stacked on #25. Merge #24, then #25, then this PR, each after review, instead of merging this branch directly into `master` with unpublished dependencies.
