# SIMVERSE — UX Principles

> Canonical product-experience standard for SIMVERSE. These principles are
> permanent and apply to every surface — Platform, Creators, Simulation, and
> Products (including Anything Wars). They sit alongside the architecture rules
> in [../AGENTS.md](../AGENTS.md) and the product vision in
> [vision/VISION.md](vision/VISION.md). Architecture decides what is *true*;
> these principles decide whether a new person can *understand and use* it.

- **Audience:** engineers, designers, and agents building any SIMVERSE surface.
- **Status:** canonical. Introduced with the Beginner Experience + Visual
  Creation Guidance v1 checkpoint.
- **Scope note:** UX simplicity never overrides server-authoritative security,
  validation, workspace isolation, or deterministic Core behavior. A simpler
  surface composes the same canonical services; it never bypasses them.

---

## The one test

Before any creation or result surface is considered finished, it must pass this
question:

> **Could a completely new user understand what to do here without us
> explaining SIMVERSE to them?**

If the answer is no, the UX is **not** finished — regardless of how complete the
underlying engineering is. A second, equally binding question guards the brand:

> **Does this feel different enough to deserve the SIMVERSE identity?**

If a page reads like a generic admin dashboard, it is not done. SIMVERSE should
feel like: **This is different. This is SIMVERSE.** (Treat that as a quality bar,
not a slogan to print on every page.)

---

## Principles

### 1. Simple first, powerful later

SIMVERSE can be deeply sophisticated internally, but a normal user should never
need to understand the engineering architecture to succeed. Lead with the
smallest set of choices that produces a real result; let depth arrive on demand.

- **In SIMVERSE today:** Anything Wars opens on **Quick War** (pick a
  competition, pick competitors, start). **Custom War** remains one click away
  for full control. Both compose the identical canonical
  Simulation → READY → Run → RUNNING services.
- **Apply it:** when adding a feature, ship the beginner path and the expert
  path as two doors into the *same* system — never two implementations.

### 2. Show before asking

When a user is offered a choice — Create Entity, Create World, Create
Simulation, Anything Wars, Animation Studio — show a small visual representation
of what that choice can produce, so they think *"if I click this, this is
roughly the kind of thing I can make."*

- **In SIMVERSE today:** every card on `/create` renders a visual mini-preview
  ([creation-previews.tsx](../src/components/create/creation-previews.tsx)): a
  lion/robot/car/country for Entity, a blueprint with terrain and zones for
  World, a VS → rules → outcome flow for Simulation.
- **Apply it:** a new creator entry point ships with a preview, not just a title
  and an icon.

### 3. Preview before entry

Do not drop a user into a complex creator before they understand what it is for.
The gateway explains and previews; the creator is entered deliberately.

- **In SIMVERSE today:** `/create` is a preview-first gateway. Quick War shows a
  readiness summary ("N competitors · Battle") before the user commits.
- **Apply it:** heavy tools (builders, editors, studios) get a preview or intro
  surface in front of them.

### 4. Intelligent defaults

Do not ask beginners questions SIMVERSE can safely answer itself. Reserve
questions for genuinely creative decisions only the user can make.

- **In SIMVERSE today:** Quick War auto-selects seed, balanced working rules,
  match configuration (duel for 2, free-for-all for more — see
  [quick.ts](../src/lib/anything-wars/quick.ts)), presentation defaults, and the
  organizing Project. The beginner is asked only *what competes* and *how*.
- **Apply it:** a default is only "intelligent" if it is safe, canonical, and
  reversible. Never fabricate a default that bypasses validation.

### 5. Progressive disclosure

Order controls by who needs them: beginner controls first, customization second,
advanced/technical controls last (and collapsed).

- **In SIMVERSE today:** the completed-run page leads with the outcome, then
  common actions, and tucks seed / tick / events / module versions inside a
  collapsed **Match details** panel
  ([runs/[runId]/page.tsx](../src/app/(platform)/anything-wars/events/[simulationId]/runs/[runId]/page.tsx)).
- **Apply it:** technical metadata is kept for the creators who want it, never
  pushed at the people who do not.

### 6. Templates before blank screens

A blank canvas is a dead end for most new users. Offer a starting point they can
make their own.

- **In SIMVERSE today:** Quick War's three competition types are pre-shaped
  starting points; World, Experience, and Tournament creators ship with original
  SIMVERSE presets (Savannah, Cinematic Battle/Race/Survival, seeded brackets).
- **Apply it:** every creator should answer "what if I don't know where to
  start?" with a concrete, editable template.

### 7. Plain language

Product surfaces speak the user's language; canonical names stay in the
architecture and code. See the terminology map below.

- **In SIMVERSE today:** in Anything Wars, Entities read as *competitors*,
  Simulations as *events/competitions*, Runs as *matches*, World Blueprints as
  *worlds/arenas*, Experience Profiles as *presentation styles*.
- **Apply it:** never rename a database or service concept to achieve friendly
  copy — translate at the presentation boundary only.

### 8. Contextual interfaces

Show controls where and when they are relevant; hide what cannot apply. A user
should not see an action they cannot take, or be offered a capability that does
not exist for their case.

- **In SIMVERSE today:** permission-gated links (`canOpenCreateDestination` in
  [catalog.ts](../src/lib/create/catalog.ts)); run controls appear only for the
  active run status; **Watch Replay** appears only for Battle, which is the only
  mode with real 3D replay.
- **Apply it:** derive visible controls from real permissions and real state,
  not from a fixed layout.

### 9. Truthful UI

Never pretend unfinished functionality exists. A visible capability must be
real; a future capability must be clearly marked as future and must not be
clickable as though it worked.

- **In SIMVERSE today:** the Create catalog carries an explicit
  `LIVE | COMING_LATER` status; Animation Studio renders as a non-interactive
  "Coming later" preview; Race and Survival never show a fake 3D Watch action;
  `/studio`, `/templates`, and `/analytics` are honestly labeled future surfaces.
  This is contract-tested in
  [catalog.test.ts](../src/lib/create/catalog.test.ts).
- **Apply it:** if you cannot ship it truthfully, ship it as a clearly-marked
  preview or not at all. Truthful UI is a correctness requirement, not a
  nicety.

### 10. Clear next action

After a user finishes something, immediately offer sensible next steps. Never
end at a dead state.

- **In SIMVERSE today:** a completed war offers Watch/Replay (Battle only), Run
  Again, Rematch, Change Competitors, and New War. The Create gateway closes
  with "organize today, see what is next."
- **Apply it:** every terminal state (saved, completed, failed) answers "what
  now?" with one obvious action.

### 11. Fast first success

A new user should reach a real, satisfying result as quickly as possible — the
first success is what earns the second session.

- **In SIMVERSE today:** `/create` names Anything Wars the "recommended first
  step" with "create your first result in minutes"; Quick War is the shortest
  real path to a saved, authoritative outcome.
- **Apply it:** measure the number of decisions between "I'm new" and "I made
  something real," and keep shrinking it.

### 12. Visual communication

Prefer an understandable preview or example over an abstract technical
explanation. A picture of the result beats a paragraph about the system.

- **In SIMVERSE today:** the Create previews, the VS/outcome simulation diagram,
  and the result-first banner communicate meaning before any prose.
- **Apply it:** when explaining a capability, ask whether a small visual would do
  the job better than a sentence.

### 13. Accessibility & responsiveness

The experience must work for everyone, on every size. This is non-negotiable and
is part of "finished."

- **Requirements:** a single `<h1>` per page with correct heading order; images
  and decorative previews carry `role="img"` + `aria-label` or `aria-hidden`
  appropriately; radio/disclosure semantics are real (`role="radiogroup"`,
  `aria-checked`, native `<details>`); reduced-motion is respected; controls stay
  tappable on mobile.
- **Breakpoints to verify:** ~390px, 768px, 1024px, 1440px, with **no horizontal
  overflow** and a comfortable side gutter at phone width.

### 14. Originality

SIMVERSE should be standard and professional, yet distinctive. Avoid the generic
admin-dashboard default; use deliberate layout, premium surfaces, and original
branding and assets.

- **In SIMVERSE today:** featured gradient cards, the VS token motif, the
  result-first trophy banner, original SIMVERSE presets and demo assets.
- **Apply it:** if a surface could belong to any SaaS tool, it has not yet earned
  the SIMVERSE identity.

---

## Beginner-facing terminology map

Product UI uses the plain-language term; architecture, services, database, and
tests keep the canonical name. Translate only at the presentation boundary.

| Canonical (code / architecture) | Beginner-facing (product UI)        |
| ------------------------------- | ----------------------------------- |
| Entity                          | Competitor / Character / Object     |
| Simulation                      | Competition / Scenario / Event      |
| Simulation Run                  | Match / Run                         |
| World Blueprint                 | World / Arena                       |
| Experience Profile              | Presentation Style                  |
| Participant                     | Competitor                          |
| Runtime                         | Experience / Viewer                 |

Do not rename database concepts to match the friendly term. Do not invent a
friendly term that implies a capability the system does not have (see Truthful
UI).

---

## Review checklist

Use this before marking any creation, simulation, or result surface complete:

- [ ] A brand-new user can tell what they can make here **without explanation**.
- [ ] The choice shows a preview before it is entered (Show before asking).
- [ ] The fastest real result is one short, obvious path (Fast first success).
- [ ] Safe defaults are applied; only creative questions remain (Intelligent
      defaults).
- [ ] Advanced/technical controls are present but deferred (Progressive
      disclosure).
- [ ] Product language is plain; canonical names stay in code (Plain language).
- [ ] Every visible capability is real; every future capability is clearly
      marked and not falsely interactive (Truthful UI).
- [ ] The surface ends with a clear next action (Clear next action).
- [ ] One `<h1>`, correct heading order, labeled visuals, real semantics
      (Accessibility).
- [ ] No horizontal overflow at 390 / 768 / 1024 / 1440 px; controls tappable on
      mobile (Responsiveness).
- [ ] It feels intentional and distinctive, not like a generic dashboard
      (Originality).
- [ ] UX simplicity did **not** bypass validation, permissions, workspace
      isolation, or deterministic Core behavior.
