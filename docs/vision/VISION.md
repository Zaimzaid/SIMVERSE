# SIMVERSE — Product & Visual Vision

## 1. Purpose of this document

This folder contains the official visual and product-direction references for the standalone SIMVERSE project.

SIMVERSE is a **new, independent project**. It must not depend on, inspect, copy from, or modify any unrelated project unless the product owner explicitly gives a later instruction to integrate something.

The presentation deck and images in this folder are **concept references**. They are intended to help engineers understand what SIMVERSE is trying to become and what the finished platform should feel like.

They are not evidence that the pictured features already exist.

---

## 2. Product definition

**SIMVERSE is a simulation and content-creation platform.**

Its long-term purpose is to let users create entities and worlds, define rules, run simulations, observe events and outcomes, analyze results, and turn those simulations into stories and content.

A useful shorthand is:

> **Create → Configure → Simulate → Observe → Analyze → Tell the story**

SIMVERSE is the universe/platform. Individual products live on top of that platform.

---

## 3. Architecture vocabulary

Keep these five pillars distinct throughout the codebase.

### PLATFORM

Shared application and business infrastructure, including cross-cutting systems.

Examples:

- accounts
- authentication
- workspaces
- teams
- permissions
- storage
- collaboration
- AI Assistant
- marketplace infrastructure
- billing
- analytics

### CORE

Reusable simulation technology.

Examples:

- simulation runtime
- entities
- state
- rules
- events
- actions
- seeded randomness
- clocks/time
- snapshots
- replay
- results

### SIMULATION MODULES

Reusable simulation-mechanics packages that run on Core. Creator/Media is not a Simulation Module.

Examples:

- battle
- racing
- tournament
- agriculture
- economy
- sports
- survival
- civilization

### CREATOR / MEDIA PLATFORM

Content-creation capabilities that can consume simulation output and also support standalone creation.

Examples:

- Asset Library
- Media Engine
- Video Studio
- Animation Studio
- captions, audio, voice, and graphics tools
- rendering and export

Animation Studio creates directed animated content and scenes. It can work without a Simulation, Simulation Run, World, or Product; it is separate from World Creation and Video Studio.

### PRODUCTS

Specific user-facing experiences built from Platform + Core + Simulation Modules + Creator/Media capabilities.

Examples:

- SIMVERSE: Anything Wars
- SIMVERSE: Robot Arena
- SIMVERSE: Farm Empire
- SIMVERSE: Civilization
- SIMVERSE: Survival
- SIMVERSE: Sports Lab

Anything Wars is intended to be the first flagship SIMVERSE Product, not SIMVERSE Core. SIMVERSE itself must never be architected as if Anything Wars is the only future product.

---

## 4. Visual identity

The concept images establish the target visual family.

The real web application should feel:

- premium
- futuristic
- cinematic
- technical
- creator-focused
- sophisticated rather than childish
- visually distinctive without sacrificing usability

### Core visual direction

- dark navy / near-black backgrounds
- cyan and electric-blue primary accents
- restrained purple accents
- bright neutral text
- subtle glass-like surfaces where appropriate
- crisp luminous borders used selectively
- strong spacing and hierarchy
- large, clean headings
- dark-mode-first presentation
- cinematic world imagery in hero/marketing contexts
- clear dashboard information architecture

### Avoid

- generic Bootstrap/admin-template appearance
- overuse of neon glow on every element
- unreadable sci-fi fonts for body text
- excessive animation that harms performance
- decorative effects that reduce accessibility
- copying a static concept image instead of building responsive functional UI

The application should **feel related to the references**, not become a pixel-for-pixel poster recreation.

---

## 5. Platform terminology

At the generic SIMVERSE platform level, prefer broad terms that can work across many simulation types.

Use:

- Entity
- World
- Simulation
- Simulation Run
- Project
- Asset
- Event
- Result
- Simulation Module
- Product
- Workspace

Do not make generic architecture depend on words such as `fighter`, `marble`, `country`, `robot`, or `competitor`.

A specific product may use a friendlier product-specific term. For example, Anything Wars may present Entities as **Competitors** in its own interface.

---

## 6. How the vision maps to actual product behavior

The broad intended workflow is:

1. **Create Entities** — people, robots, countries, cities, animals, vehicles, teams, farms, businesses, or custom objects.
2. **Build or choose a World** — an arena, track, city, farm, island, stadium, planet, factory, or another simulation environment.
3. **Set Rules & Attributes** — define stats, parameters, behaviors, environmental rules, and win/outcome conditions.
4. **Run Simulation** — execute a deterministic or stochastic simulation through SIMVERSE Core and relevant Simulation Modules.
5. **Watch Events & Results** — visualize the simulation, receive events, statistics, outcomes, and history.
6. **Generate Content** — use the Creator/Media Platform to convert important moments into replays, graphics, commentary, clips, thumbnails, captions, or other creator outputs.

Not all of this belongs in the first release. The phase plan controls when each part is implemented.

---

## 7. Anything Wars

Anything Wars is a flagship product concept built on top of SIMVERSE.

Its basic idea is:

> **Choose almost anything. Make it compete. Watch the story unfold.**

Possible user-facing categories include countries, cities, animals, robots, businesses, teams, fantasy characters, vehicles, and custom creations.

Planned competition modes can include battle, racing, tournaments, and survival.

Anything Wars product-specific UI and mechanics must not leak into generic SIMVERSE Platform or Core code unless a concept is truly reusable.

---

## 8. Content engine vision

A major long-term differentiator is turning simulation data into content.

The concept is:

```text
Simulation Run
    ↓
Events + State + Results
    ↓
Highlights / Storylines
    ↓
Replay + Commentary + Graphics
    ↓
Content outputs
```

Possible outputs include:

- 9:16 short-form video
- 16:9 video
- thumbnails
- winner posters
- leaderboard graphics
- result cards
- captions
- summaries
- hashtags

This is a long-term Creator/Media Platform capability. It must not be prematurely implemented in a phase that only calls for foundations.

---

## 9. AI Director vision

The AI Director is a later-stage system that can react to simulation events and help create cinematic presentation.

Examples:

- leader change → camera focus change
- major collision → replay marker / slow motion
- elimination → dramatic graphic
- final round/lap → stronger presentation intensity
- winner → celebration camera + result graphic

Early versions may be deterministic/rule-driven. More advanced AI decision-making can be added later.

Do not treat the visual concept as requiring an autonomous AI Director in Phase 0.

---

## 10. Dashboard vision

The Creator Dashboard concept communicates a future central workspace containing areas such as:

- Dashboard
- Create
- Projects
- Simulations
- Entities
- Worlds
- Tournaments
- Assets
- Studio
- Analytics
- Team
- Settings

The Phase 0 implementation may create navigation and intentional empty states for many of these areas. It must not fake their underlying functionality before their assigned phase.

---

## 11. Concept-art data is illustrative

Do not treat example values inside images as production requirements.

Examples of illustrative data include:

- sample project counts
- example user names
- simulation counts
- race times
- match scores
- countries/characters shown in demos
- example pricing
- example years/dates
- example marketplace values

Engineering specifications and explicit product-owner instructions override concept-art placeholder data.

---

## 12. Phase scope is authoritative

Before implementing a phase:

1. Read the current phase specification.
2. Read this vision document.
3. Review only the visual references relevant to that phase.
4. Implement the current phase only.
5. Use later-phase visuals only to preserve architectural compatibility and visual direction.

Never justify scope creep by saying a future feature appeared in a concept image.

---

## 13. Build philosophy

Use this approach:

> **Vision → phase specification → functional implementation → testing → review → Git checkpoint**

Prefer working, modular, maintainable software over superficial visual imitation.

The goal is to progressively make the real SIMVERSE application approach the vision while remaining technically sound.

---

## 14. Visual reference priority for early work

For Phase 0, the most useful references are:

- `01-cover-vision.png` — overall brand mood
- `02-platform-architecture.png` — early architecture concept; use the five-pillar model in Section 3 for current terminology
- `05-creator-dashboard.png` — dashboard information architecture and UI direction

Other images are mainly long-term references and must not expand Phase 0 scope.

---

## 15. Final instruction to implementation agents

Treat these references as **the destination and design language**, not as a demand to build the entire destination immediately.

Build the software phase by phase.
