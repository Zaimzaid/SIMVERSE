# SIMVERSE — Simplified Pre-login Landing Page

**Branch:** `feature/build-your-civilization-simplified-public-home`  
**Base:** `feature/build-your-civilization-phase4-assemblies` (draft PR #57).  
**Scope:** The public `/` landing page only. Login, registration, authenticated dashboard, application data, fictional geography, citizenship and district APIs remain unchanged.

## Problem addressed

The existing visitor page used a large hero plus architecture, vision, four journey cards, status/product sections and repeated CTAs. Guest navigation contained four topical links, and the mobile navigation concealed Log in. This overwhelmed visitors before they understood the core product.

## New experience

- Compact logo and nav: Explore (desktop), Log in and Join now, with both account links visible on narrow screens. Authenticated users get Dashboard instead.
- One clear statement: **Build your civilization.**
- One-line product introduction: explore a fictional world, meet people and help shape communities.
- Two intentional primary actions: **Join SIMVERSE** (register) and **Explore the planet** (public existing globe route). Signed-in people get Dashboard instead of registration.
- Single lightweight client interaction: **Explore / Connect / Shape** explains the citizen journey. Explicit availability labels distinguish the working planet preview from future district/community-building features. Accessible pressed state, keyboard-operable native buttons and polite live text update.
- Original, already-committed fictional-world atlas illustration, with distinct light/dark gradients and mobile framing; no new external asset dependencies or placeholder fake videos.
- Minimal site footer; removed long marketing sections, repeated CTAs and technical architecture explanation.
- Honest early-access disclaimer: fictional planet remains a visual prototype; live districts, citizen-built structures and Vascoin are not yet available.

## Constraints and testing

- Existing accounts, saved world, profile, registration/login flows and signed-in dashboard are unchanged.
- No new database models, migrations, fixtures, external API requests, images or auth handling.
- The page must load without WebGL; the optional planet route continues to handle its own no-WebGL fallback.
- Source tests verify the three choices, default selected state, state changes and honest labels.
- Verify at 320, 390, 768 and 1366 px in dark/light modes. Check the mobile header fits without horizontal overflow, all active links navigate correctly, tab-like choice buttons update the explanation, focus outlines are visible and no accidental account redirects occur.
- CI typecheck, lint, tests and Next production build are necessary but **do not replace visual QA**.
- Not merged, deployed or owner-approved until review.

## Review URLs

- `/` — simplified public homepage
- `/planet` — existing public fictional planet preview
- `/login` — unchanged authentication
- `/register` — unchanged registration

Future brand naming or deeper 3D art decisions can be layered on later; this task intentionally makes no broad product or brand changes.
