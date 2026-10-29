# SIMVERSE Video Studio — Phase 1

## Purpose

The Video Studio is the first **general-purpose video editing workspace** in SIMVERSE. It is independent of the existing completed-simulation storyboard creator at /studio and the standalone animation editor at /animation.

**Route:** /studio/video (signed-in SIMVERSE workspace with media.create and media.edit permissions).

## What works in Phase 1

- Import a video from the user's device, or drag and drop onto the preview.
- Preview the video on a canvas; play, pause, and seek.
- Select clip start and end positions without editing or overwriting the source file.
- Change output framing between 16:9 landscape, 9:16 vertical, and 1:1 square.
- Fit the full source (letterbox) or fill the frame by center-cropping.
- Adjust brightness, contrast, and saturation.
- Add an editable single text overlay with size, color, placement, and start/end display times.
- Add one image watermark or logo (PNG, JPEG, WebP), top right.
- Set playback speed (0.5×–2×), volume, or mute.
- Capture the same canvas composition used for previews into a downloadable WebM file using MediaRecorder. Audio is mixed from the source element through Web Audio when available.
- Provide export progress, cancellation, basic errors and reset controls.

Imported files are accessed with browser object URLs; **no video is uploaded to the server**. The original file remains unchanged. This approach avoids inventing upload, storage, billing and rendering infrastructure before those systems exist.

## Important limitations

1. This is a **single-clip, single-title, single-logo** editor, not a professional multi-track editor.
2. Export is **WebM**, not MP4. Support depends on the active browser's MediaRecorder and Canvas captureStream implementations. Use recent Chromium or Firefox for initial QA; browser audio/codec behavior varies.
3. Export operates at playback speed, so keep the tab visible. Very large videos can consume significant memory/CPU.
4. Phase 1 project edits are local in-memory React state and **will not survive a refresh**. The exported media file is saved by the browser. Cloud persistence and reusable media project files are future deliverables.
5. No automatic subtitles, transitions, AI editing, voice-over generation, dedicated audio tracks, livestreaming, multi-clip timeline, or server rendering.
6. Output is bounded to 1280×720, 720×1280, or 1080×1080. Resolution presets, aspect-aware placement controls, MP4, and offline render queues are future work.
7. Only use media you own or have permission to edit and distribute. Overlaying a watermark is not a substitute for copyright permission.

## Manual acceptance checks

1. Sign into a workspace with media permissions. Visit /studio and click **Open Video Studio**.
2. Import an MP4 with H.264 video and an audio track. Confirm frame preview, play/pause, and seeking work.
3. Trim a 20-second sample to approximately 3–10 seconds. Confirm the preview stops at the end of the selected range.
4. Switch between 16:9, 9:16, and 1:1. Test "show whole video" and "fill frame"; verify no aspect distortion.
5. Add white title text, move to top, change size and display interval; add a PNG logo; adjust brightness and saturation.
6. Set speed to 1.5× and change source volume. Export WebM in Chrome/Edge and Firefox and inspect picture, sound, duration, text timing, and logo. Confirm playback and exports remain usable after a second attempt.
7. Cancel an export; ensure no partial download occurs.
8. Confirm existing /studio/{artifactId} storyboards and /animation still work.
9. Verify a read-only account cannot import or export.

Run checks before merging:

    npm ci
    npm run db:generate
    npm run typecheck
    npm run lint
    npm run test
    npm run build

## Next milestones

- Durable user/project storage, uploaded asset records, recovery, export history and authorization.
- A true multi-track timeline with multiple clips, audio, images, transitions, titles, undo/redo and independent scene timing.
- Server rendering with FFmpeg and MP4/H.264/AAC, error recovery, job progress and 720p/1080p/4K presets.
- Captions with editable transcript, multilingual support, SRT/VTT export, voiceover and audio-mixing tools.
- Brand kits, ready-made templates, color grading, keyframes, reusable graphics, AI-assisted tasks and rights management.
- Publishing integrations only after official API authorization.

## Definition of completion

Do not count Phase 1 as fully verified until real video/audio exports have been tested in supported browsers. Passing TypeScript and unit tests alone does not prove MediaRecorder or browser audio success.
