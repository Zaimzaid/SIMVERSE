# SIMVERSE Social + Animation Expansion — V2

**Code branch:** `feature/social-animation-expansion-v2`, stacked on V1 draft [PR #24](https://github.com/Zaimzaid/SIMVERSE/pull/24).
**Release status:** developed as a pilot; separate CI and human browser validation required before any merge. No claim of finished commercial-grade social network, native calling or cinematic animation suite.

## User-facing additions

### Community /social
- **Private groups:** owner creates a group and invites 1–10 accepted unblocked friends. Every invitee must independently accept before viewing/sending messages. Group members can leave; owner transfer/disband are later work.
- **Text + media sharing:** direct/group messages can share a bounded public HTTPS *link* to photos/videos in PNG/JPG/WebP/GIF/MP4/WebM formats. **Not uploads or SIMVERSE-hosted file storage**. Links open externally and may disappear. Do not paste private or tokenized URLs.
- **Reactions:** toggle 👍 ❤️ 😂 😮 👏 🔥 on authorized direct/group messages. Preview UI exposes the main three.
- **Notifications:** private persistent alerts for invitations, friend acceptance, new direct/group messages, call offers. Read/unread state and background polling *while Community is open*. Notifications are not push notifications and do not deliver while the app is closed.
- **Voice/video calls:** opt-in browser WebRTC audio/video using getUserMedia, authenticated server-scoped expiring signaling records, ICE and explicit accept/decline/hangup. Recipient must be an accepted friend. Browser must support WebRTC, secure context (HTTPS or localhost) and permissions. **STUN only** for the pilot; no production TURN/media relay, cross-device NAT reliability, background wakeup or persistent call records. No call recordings. Group calls are not implemented.

### Animation Studio
- Existing `/animation`: original 2D keyframe scenes, saving and timeline.
- New **`/animation/3d` Avatar & Camera Lab**: original low-poly 3D Three.js figure, selectable skin/outfit/hair palette, height and hair appearance, basic joint-driven limb motion, two-shot camera yaw/pitch/distance interpolation.
- **Dialogue & approximate lip movement:** text entered into the scene; browser SpeechSynthesis speaks where supported when Play is selected; mouth movement is sinusoidal timing approximation, **not actual phoneme extraction, speech-to-viseme inference or performance-quality lip sync**.
- **Browser video export:** MediaRecorder captures the 3D canvas and downloads **silent WebM** if supported. Not MP4 or exported audio. No external rendering infrastructure. 2D timeline and 3D editor share the existing owner/workspace `AnimationProject` storage; older V1 records remain compatible.
- The figure has simple hierarchical articulated parts, **not a Blender/GLB-imported skinned rig**. Facial blend shapes, accurate IK, mocap, complex animation and cinematic scenes require a later asset system.

## Data and privacy controls
- New Prisma models: `SocialGroup`, `SocialGroupMember`, `SocialGroupMessage`, `SocialReaction`, `SocialNotification`, `SocialCallSignal`; nullable `SocialMessage.mediaUrl`.
- Group message access checks membership every request; invited accounts cannot read. Direct reactions check both participants and friendship; group reactions require active membership. Blocked direct messages/calls remain inaccessible.
- WebRTC signaling requires both players be accepted unblocked friends; offers and responses have time-limited retrieval; signals store SDP/ICE text temporarily in DB (there is not yet a retention cleanup job).
- URLs are user-submitted, validated HTTPS media references; no server-side fetching, so no server-side SSRF. External links may expose the visiting player's IP to the media host.
- Never deploy SQLite schema pushes without approved migrations, backup/recovery and user-data privacy review.

## Tests / acceptance
- CI needs `npm run db:generate`, isolated `npm run db:push`, TypeScript, ESLint, complete Vitest suite, Next production build.
- Social tests: no group creation for strangers; invited account cannot read before acceptance; outsiders cannot read or react; valid/invalid URLs; independent friend acceptance; authenticated call signaling.
- Avatar schema tests: old 2D scene backward compatibility, camera key ordering, dialogue time bounds.
- Two-browser real-device QA: register accounts, friendship accept, invite group, decline/leave, send text/media link, toggle reaction, read alerts, voice/video call with camera/mic permission; test blocked/anonymous callers directly via API.
- Animation manual QA: customize avatar, scrub camera, play dialogue, create and reopen saved 3D scene, record WebM on Firefox/Chrome; verify video has no audio. Test WebGL disabled and MediaRecorder unavailable gracefully.

## Remaining product work (not represented as complete)
Media storage/upload scanning, group moderation/reporting, attachments in private secure object storage, protected media authorization, end-to-end encryption, group admin rotation, reliable WebSocket chat and notifications, push alerts, call media relay/TURN with scalable signaling, voice/video call UX at production scale, true imported skinned humanoids, IK, mocap, cameras with multi-shot editor, recorded dialogue/audio mixing, phoneme/viseme lip sync, MP4 transcoding, complete publishing/commercial licensing and performance budget controls.

**Do not claim the list above shipped because the UI contains a preview.** Evaluate the actual scene and call setup on the owner's laptop before release.
