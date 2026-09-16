# Claude Code — Visual Reference Instructions

Add or adapt the following block near the beginning of a SIMVERSE implementation prompt when visual references are useful:

```text
============================================================
SIMVERSE VISUAL / PRODUCT REFERENCES
============================================================

Before designing or modifying the SIMVERSE UI, read:

docs/vision/VISION.md
docs/vision/REFERENCE_INDEX.md

Then inspect the relevant images inside:

docs/vision/references/

These files communicate the intended SIMVERSE visual identity, product direction,
information architecture and long-term experience.

IMPORTANT:

- They are CONCEPT DESIGNS, not screenshots of an already-built application.
- The current phase specification controls implementation scope.
- Do not implement later-phase functionality merely because it appears in a concept image.
- Do not treat illustrative statistics, prices, dates, users, scores or content as production data.
- Reproduce the visual language through real responsive components rather than embedding the concept image as the application UI.
- Preserve accessibility, responsive behavior, maintainability and performance.

For Phase 0, prioritize these references:

01-cover-vision.png
02-platform-architecture.png
05-creator-dashboard.png

Use the others only as long-term architectural context.
```
