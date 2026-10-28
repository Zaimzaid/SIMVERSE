# SIMVERSE Social Messaging & Animation Studio — V1

**Development branch:** `feature/social-messaging-animation-studio-v1`  
**Base:** merged `master` as of 28 October 2026.  
**Goal:** deliver a first usable Community experience and a standalone animation authoring tool, without mislabeling unfinished real-time/3D production features.

## A. Community — implemented
- Authenticated `/social` hub with public username lookup (exact usernames only; only profiles set `PUBLIC` and with a chosen username are discoverable).
- Send friend invitation. Only recipient can accept; either side can remove/decline. Unique canonical unordered pair prevents duplicates.
- Friends directory and persistent private 1:1 text chats.
- Message storage with sender/recipient IDs, timestamps and readAt. Messages can be sent or viewed only when friendship is ACCEPTED and neither player has blocked the other.
- Block and unblock APIs. Blocking deletes friendship immediately but does not erase old messages. Unblocking never silently restores friendship; both players must reconnect. Private chat history is inaccessible while blocked/not-friends.
- Friend-request and message-rate caps, message body bounds and recipient authorization.
- No public inbox exposure, contact import, hidden profile search, or implicit friend grants based on workspace membership.
- Chat refresh is manual in V1; no WebSocket, online/presence, delivery guarantee or background push notification.

### Routes
- `/social`: player search, requests, friends and private conversation.
- `GET /api/social?username={exact-public-username}` or `GET /api/social`.
- `POST/PATCH /api/social/friends`: invite and accept/remove.
- `POST/DELETE /api/social/blocks`: block/unblock.
- `GET/POST /api/social/messages`: messages read/send by mutually accepted friends.
- All endpoints require a valid authenticated session.

### Social scope not done
Group chats, friends ranking/streaks, message editing/deleting, attachments, voice notes, rich media, chat reactions, stickers, translation, disappearing-message controls, typing/presence indicators, mentions, notifications, voice/video calls, WebRTC/screen sharing, social map or location. These require separate storage/privacy/moderation designs and should not be shown as live.

## B. Animation Studio — implemented
- `/animation` authoring page, linked from Create and Studio.
- Standalone, workspace-scoped version-1 **2D keyframe editor** with a live SVG scene preview, Play/Pause, timeline scrubbing, actor selection, 1–6 geometric actors and 2–32 sorted keyframes per actor.
- Time/position (x/y), rotation and scale keyframes; linear interpolation; shape/color and background colors.
- Duration 1–60 seconds; deterministic project JSON validated by Zod on the server.
- Saved projects scoped to `ownerId` **and** `workspaceId`; server enforces `media.view`, `media.create`, and `media.edit` permissions; can list, create, update and delete. Hard cap 60 projects per user/workspace.
- Does not need a simulation run, does not modify authoritative simulation results, and does not claim to render a 3D animation/video.

### Animation scope not done
Blender/glTF import, rigging, 3D timeline, camera paths, multiple scenes/shots, environmental lighting, dialogue/voice/music, facial or lip-sync, sound effects, VFX, AI-directed motion, GPU/offline rendering, MP4/WebM export, character inventory and collaborative editing. These are future standalone creator phases, not the first pilot.

## C. Testing and data safety
Automated tests cover privacy discovery; blocked user behavior; independent friend acceptance; direct messaging authorization; keyframe interpolation; scene validation; saved project ownership, access control and CRUD. Re-run: `npm run db:generate`, `npm run db:push`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` in a **disposable SQLite environment**.

**Schema has new tables.** Do not point `npm run db:push` or reset helpers at an existing valuable database. Back up first and plan any production migration separately.

Laptop QA:
1. Two test players register and make usernames/public profiles, search an exact public username.
2. Player A invites B; before B accepts, both cannot message; B accepts and both can send and refresh chat history.
3. Player B blocks A; messages are forbidden even with direct API calls; unblock does not auto-refriend.
4. Reload the app and confirm message/history persisted.
5. On `/animation`, create an independent scene, add an actor, edit 2–4 keyframes, Play and scrub; Save and reload the project.
6. Test viewer workspace role: can view authored projects where permitted but cannot create or edit. Another user/workspace cannot load someone's private project.
7. Verify `/create` animation card and top nav shortcuts. Check 390px mobile and dark/light contrast.

## D. Follow-up roadmap
**Social V2:** conversation list with unread counts, reporting/moderation, edit/delete, notifications, group threads, media with a consent/storage policy.  
**Social V3:** real-time WebSockets, online presence, voice/video/WebRTC and world-linked social experiences.  
**Animation V2:** reusable entity/asset tracks, multiple scenes, easing curves, camera and voice/dialogue tracks with source attribution.  
**Animation V3:** actual 3D models, rigged characters, timeline keyframes, preview quality settings and gated video rendering/export.

No part of the V1 editor is an actual Unreal/Blender scene. The current V1 is usable for prototype 2D storytelling and as an authoring foundation.
