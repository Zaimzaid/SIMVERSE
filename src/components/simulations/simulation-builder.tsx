"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Globe2,
  Hash,
  Info,
  LayoutGrid,
  Palette,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  BATTLE_FORMATS,
  BATTLE_FORMAT_LABELS,
  ROUND_LIMIT_MAX,
  SIMULATION_DIFFICULTIES,
  SIMULATION_DIFFICULTY_META,
  SIMULATION_SPEEDS,
  SIMULATION_SPEED_LABELS,
  TOURNAMENT_FORMATS,
  TOURNAMENT_FORMAT_LABELS,
  defaultModeConfig,
  type SimulationGeneralConfig,
  type SimulationPresentationConfig,
} from "@/lib/simulations/config";
import {
  DEFAULT_RACE_CHECKPOINTS, DEFAULT_RACE_STAT_MAPPING, RACE_DISTANCE_UNITS,
  RACE_DISTANCE_UNIT_LABELS, RACE_MAX_CHECKPOINTS, RACE_MAX_DISTANCE, RACE_MAX_LAPS,
  RACE_MAX_TICKS, RACE_MODES, RACE_MODE_LABELS, defaultRaceConfigV1, raceConfigV1Schema,
  type RaceConfigV1,
} from "@/lib/modules/race/config";
import {
  DEFAULT_SURVIVAL_STAT_MAPPING,
  SURVIVAL_CONDITION_MAX,
  SURVIVAL_MAX_DEPLETION_PENALTY,
  SURVIVAL_MAX_DRAIN,
  SURVIVAL_MAX_RECOVERY,
  SURVIVAL_MAX_RECOVERY_INTERVAL,
  SURVIVAL_MAX_TICKS,
  SURVIVAL_MODES,
  SURVIVAL_MODE_LABELS,
  SURVIVAL_RESOURCE_MAX,
  defaultSurvivalConfigV1,
  survivalConfigV1Schema,
  type SurvivalConfigV1,
} from "@/lib/modules/survival/config";
import { minEntitiesForMode, resolveMode, selectableModes } from "@/lib/simulations/modes";
import { generateSeed, isValidSeed, normalizeSeed } from "@/lib/simulations/seed";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import {
  anythingWarsExecutionIssue,
  anythingWarsParticipantLimit,
} from "@/lib/anything-wars/constants";
import { anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { cn } from "@/lib/utils";
import type { SimulationView } from "@/server/services/simulation-service";
import { useToast } from "@/components/ui/toast";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ModeCard } from "./mode-card";
import { EntityPicker } from "./entity-picker";
import type { ParticipantChoice, SimulationBuilderInitial } from "./simulation-builder-model";

// The mapper `simulationToBuilderInitial` lives in the server-safe
// `simulation-builder-model` module so a Server Component can call it. Only the
// (erased) type is re-exported here — never the mapper — keeping the boundary intact.
export type { SimulationBuilderInitial } from "./simulation-builder-model";

const MODE_OPTIONS = selectableModes();

const STEPS = [
  { title: "Basics", icon: FileText },
  { title: "Mode", icon: LayoutGrid },
  { title: "Entities", icon: Users },
  { title: "Rules", icon: SlidersHorizontal },
  { title: "Environment", icon: Globe2 },
  { title: "Presentation", icon: Palette },
  { title: "Seed", icon: Hash },
  { title: "Review", icon: ClipboardCheck },
] as const;

const LAST_STEP = STEPS.length - 1;
const ANYTHING_WARS_STEP_TITLES = [
  "Event", "Mode", "Competitors", "Match rules", "World / Arena", "Presentation style", "Seed", "Ready to start",
] as const;

/** "keep" preserves the stored seed; "auto" regenerates on save; "custom" uses the entered value. */
type SeedMode = "keep" | "auto" | "custom";

export interface SimulationBuilderProps {
  mode: "create" | "edit";
  initial: SimulationBuilderInitial;
  /** Active projects the simulation may belong to. */
  projects: { id: string; name: string }[];
  /** Active immutable World versions available to bind to this definition. */
  worlds: { worldId: string; worldName: string; biome: string; version: number; status: string; current: boolean }[];
  /** Active immutable Experience Profile versions available to this definition. */
  experiences: { experienceProfileId: string; experienceProfileName: string; preset: string; version: number; status: string; current: boolean; modeCompatibility: string[] }[];
  /** Name of the current project, used when it isn't in `projects` (e.g. archived). */
  projectName?: string;
  /** Product copy and product API/routing while retaining the generic Simulation model. */
  variant?: "platform" | "anything-wars";
  /** Product launch requires simulation.run; the API remains authoritative. */
  canRun?: boolean;
}

/**
 * The Simulation Builder — an 8-step wizard that produces a CONFIGURATION only.
 * Nothing here runs a simulation: "Ready" means the blueprint is complete and
 * valid; execution availability is determined separately by the engine registry.
 */
export function SimulationBuilder({
  mode,
  initial,
  projects,
  worlds,
  experiences,
  projectName,
  variant = "platform",
  canRun = false,
}: SimulationBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [id, setId] = useState(initial.id);
  const [step, setStep] = useState(0);

  const [name, setName] = useState(initial.name);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [description, setDescription] = useState(initial.description);
  const [simMode, setSimMode] = useState(initial.mode);
  const [participants, setParticipants] = useState<ParticipantChoice[]>(initial.participants);
  const [general, setGeneral] = useState<SimulationGeneralConfig>(initial.general);
  const [modeConfig, setModeConfig] = useState<Record<string, unknown>>(initial.modeConfig);
  const [presentation, setPresentation] = useState<SimulationPresentationConfig>(initial.presentation);
  const [worldBinding, setWorldBinding] = useState(initial.worldId && initial.worldVersion
    ? `${initial.worldId}::${initial.worldVersion}` : "");
  const [experienceBinding, setExperienceBinding] = useState(initial.experienceProfileId && initial.experienceProfileVersion
    ? `${initial.experienceProfileId}::${initial.experienceProfileVersion}` : "");

  const [seedMode, setSeedMode] = useState<SeedMode>(initial.id && initial.seed ? "keep" : "auto");
  const [customSeed, setCustomSeed] = useState(initial.seed);
  const [currentSeed, setCurrentSeed] = useState(initial.seed);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readyIssues, setReadyIssues] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);

  const busy = saving || markingReady;
  const isAnythingWars = variant === "anything-wars";
  const minEntities = minEntitiesForMode(simMode);
  const resolvedMode = resolveMode(simMode);
  const executionIssue = isAnythingWars
    ? anythingWarsExecutionIssue(simMode, modeConfig, participants.length)
    : null;
  const modeOptions = isAnythingWars
    ? MODE_OPTIONS.filter((option) => ["battle", "race", "survival"].includes(option.key))
    : MODE_OPTIONS;

  // Merge the current project into the option list when it isn't already there.
  const projectOptions = useMemo(() => {
    const list = projects ?? [];
    if (projectId && !list.some((p) => p.id === projectId)) {
      return [{ id: projectId, name: projectName ?? "Current project" }, ...list];
    }
    return list;
  }, [projects, projectId, projectName]);

  // Client mirror of the server READY checks — drives the checklist and gates
  // "Mark ready". The server remains authoritative when the button is pressed.
  const checklist = useMemo(
    () => [
      { ok: name.trim().length > 0, label: "Has a name", step: 0 },
      { ok: projectId.length > 0, label: "Attached to a project", step: 0 },
      { ok: resolvedMode.availability === "available", label: "Mode is available", step: 1 },
      {
        ok: participants.length >= minEntities,
        label: `At least ${minEntities} ${isAnythingWars ? "competitors" : "participants"} (have ${participants.length})`,
        step: 2,
      },
      ...(isAnythingWars ? [{
        ok: executionIssue === null,
        label: executionIssue ?? "Competitor count and mode configuration are supported",
        step: executionIssue?.toLowerCase().includes("config") ? 3 : 2,
      }] : []),
      {
        ok: seedMode !== "custom" || isValidSeed(normalizeSeed(customSeed)),
        label: "Seed is valid",
        step: 6,
      },
    ],
    [name, projectId, resolvedMode.availability, participants.length, minEntities, seedMode, customSeed, isAnythingWars, executionIssue],
  );
  const isReady = checklist.every((c) => c.ok);

  function onChangeMode(next: string) {
    setSimMode(next);
    // Reset only the mode-specific placeholders to the new mode's defaults; the
    // general settings are mode-agnostic and carry over.
    setModeConfig(defaultModeConfig(next));
    setExperienceBinding((current) => {
      if (!current) return current;
      const [profileId, version] = current.split("::");
      return experiences.some((profile) => profile.experienceProfileId === profileId && String(profile.version) === version && profile.modeCompatibility.includes(next)) ? current : "";
    });
  }

  function seedForPayload(): string | undefined {
    if (seedMode === "custom") return normalizeSeed(customSeed);
    if (seedMode === "auto") return ""; // server generates a fresh seed
    return undefined; // "keep" — omit so the stored seed is preserved
  }

  function buildPayload() {
    const [worldId, versionText] = worldBinding ? worldBinding.split("::") : ["", ""];
    const [experienceProfileId, experienceVersionText] = experienceBinding ? experienceBinding.split("::") : ["", ""];
    const payload: Record<string, unknown> = {
      projectId,
      name: name.trim(),
      description,
      mode: simMode,
      participants: participants.map((p, index) => ({ entityId: p.entityId, position: index })),
      configuration: { general, mode: modeConfig },
      presentation: {
        displayTitle: presentation.displayTitle,
        themeColor: presentation.themeColor,
        showLabels: presentation.showLabels,
        showLeaderboard: presentation.showLeaderboard,
      },
      worldId: worldId || null,
      worldVersion: versionText ? Number(versionText) : null,
      experienceProfileId: experienceProfileId || null,
      experienceProfileVersion: experienceVersionText ? Number(experienceVersionText) : null,
    };
    const seed = seedForPayload();
    if (seed !== undefined) payload.seed = seed;
    return payload;
  }

  /** Persist the current state (create on first save, then update). Returns the saved view or null. */
  async function persist(): Promise<SimulationView | null> {
    // Minimum needed for a row to exist / the schema to accept it.
    const localErrors: Record<string, string> = {};
    if (name.trim().length === 0) localErrors.name = "Enter a simulation name.";
    if (projectId.length === 0) localErrors.projectId = "Choose a project.";
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setStep(0);
      toast({ variant: "error", title: "Add the basics first", description: "A name and project are required to save." });
      return null;
    }

    setErrors({});
    setReadyIssues([]);
    setSaving(true);

    const path = isAnythingWars
      ? id ? `/api/anything-wars/events/${id}` : "/api/anything-wars/events"
      : id ? `/api/simulations/${id}` : "/api/simulations";
    const method = id ? "PATCH" : "POST";
    const { data, error } = await apiFetch<{ simulation: SimulationView }>(path, {
      method,
      body: JSON.stringify(buildPayload()),
    });
    setSaving(false);

    if (error) {
      if (error.details?.length) {
        setErrors(fieldErrorsFrom(error));
        toast({ variant: "error", title: "Couldn’t save", description: "Some settings need attention." });
      } else {
        toast({ variant: "error", title: "Couldn’t save", description: error.message });
      }
      return null;
    }

    const saved = data?.simulation ?? null;
    if (saved) {
      setId(saved.id);
      setCurrentSeed(saved.seed ?? "");
      // After a save, the seed is known and persisted — settle on "keep" so
      // subsequent saves don't churn it (unless the user picks custom/regenerate again).
      if (seedMode !== "custom") {
        setSeedMode("keep");
        setCustomSeed(saved.seed ?? "");
      }
    }
    return saved;
  }

  async function onSaveDraft(navigate: boolean) {
    const saved = await persist();
    if (!saved) return;
    toast({ variant: "success", title: "Draft saved", description: `“${saved.name}” was saved as a draft.` });
    if (navigate) {
      router.push(isAnythingWars ? `/anything-wars/events/${saved.id}` : `/simulations/${saved.id}`);
      router.refresh();
    }
  }

  async function onMarkReady() {
    if (isAnythingWars && !canRun) {
      toast({ variant: "error", title: "You cannot start this war", description: "Your workspace role does not include permission to run simulations." });
      return;
    }
    setMarkingReady(true);
    const saved = await persist();
    if (!saved) {
      setMarkingReady(false);
      return;
    }
    const readyPath = isAnythingWars
      ? `/api/anything-wars/events/${saved.id}/ready`
      : `/api/simulations/${saved.id}/ready`;
    const { error } = await apiFetch<{ simulation: SimulationView }>(readyPath, {
      method: "POST",
    });
    if (error) {
      setMarkingReady(false);
      if (error.details?.length) {
        setReadyIssues(error.details.map((d) => d.message));
        setErrors(fieldErrorsFrom(error));
      }
      toast({ variant: "error", title: "Not ready yet", description: error.message });
      setStep(LAST_STEP);
      return;
    }

    if (isAnythingWars) {
      const created = await apiFetch<{ run: { id: string } }>(`/api/anything-wars/events/${saved.id}/runs`, {
        method: "POST",
      });
      if (created.error || !created.data?.run) {
        setMarkingReady(false);
        toast({ variant: "error", title: "War saved but could not start", description: created.error?.message ?? "A Run could not be created." });
        router.push(`/anything-wars/events/${saved.id}`);
        router.refresh();
        return;
      }
      const started = await apiFetch<{ run: { id: string } }>(`/api/simulation-runs/${created.data.run.id}/start`, {
        method: "POST",
      });
      setMarkingReady(false);
      if (started.error) {
        toast({ variant: "error", title: "Run created but could not start", description: started.error.message });
      } else {
        toast({ variant: "success", title: "War started", description: "The authoritative Run is ready to continue." });
      }
      router.push(anythingWarsRunHref(saved.id, created.data.run.id));
      router.refresh();
      return;
    }

    setMarkingReady(false);
    toast({ variant: "success", title: "Marked ready", description: "The configuration is complete and valid." });
    router.push(`/simulations/${saved.id}`);
    router.refresh();
  }

  const StepIcon = STEPS[step]?.icon ?? FileText;
  const stepTitle = isAnythingWars
    ? ANYTHING_WARS_STEP_TITLES[step] ?? ""
    : STEPS[step]?.title ?? "";

  return (
    <div className="space-y-6">
      {/* Stepper rail */}
      <nav aria-label="Builder steps" className="-mx-1 overflow-x-auto pb-1">
        <ol className="flex min-w-max items-center gap-1 px-1">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const active = index === step;
            return (
              <li key={s.title} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                      active ? "border-accent bg-accent text-accent-foreground" : "border-border-strong",
                    )}
                  >
                    {index + 1}
                  </span>
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{isAnythingWars ? ANYTHING_WARS_STEP_TITLES[index] : s.title}</span>
                </button>
                {index < LAST_STEP ? <span className="mx-0.5 h-px w-3 bg-border" aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <Card as="section">
        <CardHeader className="flex-row items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border-strong bg-background/60 text-accent">
            <StepIcon className="size-5" />
          </span>
          <div>
            <CardTitle>
              Step {step + 1} of {STEPS.length} · {stepTitle}
            </CardTitle>
            <CardDescription>{isAnythingWars ? ANYTHING_WARS_STEP_BLURBS[step] : STEP_BLURBS[step]}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* STEP 0 — BASICS */}
          {step === 0 ? (
            <div className="space-y-5">
              <Field label="Name" htmlFor="sim-name" required error={errors.name}>
                <Input
                  id="sim-name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  invalid={Boolean(errors.name)}
                  placeholder="e.g. African Nations Battle"
                  autoFocus
                />
              </Field>

              <Field
                label="Project"
                htmlFor="sim-project"
                required
                error={errors.projectId}
                hint="The simulation lives in this project. Its entities come from the project’s library."
              >
                {projectOptions.length === 0 ? (
                  <div className="rounded-lg border border-border-strong bg-surface p-4 text-sm text-secondary">
                    You don’t have any projects yet.{" "}
                    <Link href="/projects/new" className="font-medium text-accent hover:underline">
                      Create one first
                    </Link>
                    .
                  </div>
                ) : (
                  <Select
                    id="sim-project"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    invalid={Boolean(errors.projectId)}
                  >
                    <option value="" disabled>
                      Choose a project…
                    </option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label="Description"
                htmlFor="sim-description"
                error={errors.description}
                hint="Optional. What is this simulation about?"
              >
                <Textarea
                  id="sim-description"
                  value={description}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  invalid={Boolean(errors.description)}
                />
              </Field>
            </div>
          ) : null}

          {/* STEP 1 — MODE */}
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {modeOptions.map((m) => (
                <ModeCard
                  key={m.key}
                  mode={m}
                  selected={m.key === simMode}
                  onSelect={() => onChangeMode(m.key)}
                />
              ))}
              {isAnythingWars ? (
                <Link href="/anything-wars/tournaments/new" className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50">
                  <span className="font-medium text-foreground">Tournament</span>
                  <span className="mt-1 block text-sm text-muted">Build a multi-match competition with the existing Tournament system.</span>
                </Link>
              ) : null}
            </div>
          ) : null}

          {/* STEP 2 — ENTITIES */}
          {step === 2 ? (
            <div className="space-y-3">
              {errors.participants ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {errors.participants}
                </p>
              ) : null}
              <EntityPicker
                projectId={projectId || null}
                value={participants}
                onChange={setParticipants}
                minEntities={minEntities}
                maxEntities={isAnythingWars ? anythingWarsParticipantLimit(simMode) : undefined}
                language={isAnythingWars ? "competitors" : "entities"}
                createHref={isAnythingWars ? `/entities/new?returnTo=${encodeURIComponent("/anything-wars/create")}` : undefined}
                showAttributes={isAnythingWars}
              />
            </div>
          ) : null}

          {/* STEP 3 — RULES & SETTINGS */}
          {step === 3 ? (
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Speed" htmlFor="sim-speed" hint={simMode === "battle"
                  ? "A presentation preference; Battle v1 turn order uses Entity Speed attributes."
                  : simMode === "race" ? "A presentation preference; Race v1 pace uses the configured Entity Speed attribute."
                  : simMode === "survival" ? "A presentation preference; Survival v1 uses its configured frozen attributes below."
                  : "A stored preference for this mode."}>
                  <Select
                    id="sim-speed"
                    value={general.speed}
                    onChange={(e) => setGeneral({ ...general, speed: e.target.value as SimulationGeneralConfig["speed"] })}
                  >
                    {SIMULATION_SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {SIMULATION_SPEED_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Difficulty" htmlFor="sim-difficulty">
                  <Select
                    id="sim-difficulty"
                    value={general.difficulty}
                    onChange={(e) =>
                      setGeneral({ ...general, difficulty: e.target.value as SimulationGeneralConfig["difficulty"] })
                    }
                  >
                    {SIMULATION_DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {SIMULATION_DIFFICULTY_META[d].label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field
                label="Round limit"
                htmlFor="sim-round-limit"
                error={errors["configuration.general.roundLimit"]}
                hint={simMode === "battle"
                  ? "Battle v1 treats this as a tick limit. Blank means 120 ticks; values above 160 execute with a 160-tick cap."
                  : simMode === "race" ? "Stored for compatibility. Race v1 uses its explicit maximum tick setting below."
                  : simMode === "survival" ? "Stored for compatibility. Survival v1 uses its explicit maximum tick setting below."
                  : `Optional cap on rounds/turns. Leave blank for no explicit limit (max ${ROUND_LIMIT_MAX.toLocaleString()}).`}
              >
                <Input
                  id="sim-round-limit"
                  type="number"
                  min={1}
                  max={ROUND_LIMIT_MAX}
                  value={general.roundLimit ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setGeneral({ ...general, roundLimit: null });
                      return;
                    }
                    const n = Number.parseInt(raw, 10);
                    setGeneral({
                      ...general,
                      roundLimit: Number.isFinite(n) ? Math.max(1, Math.min(ROUND_LIMIT_MAX, n)) : null,
                    });
                  }}
                  placeholder="No limit"
                  className="max-w-48"
                />
              </Field>

              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="sim-random-events" className="block text-sm font-medium text-foreground">
                      Random events
                    </label>
                    <span className="block text-xs text-muted">{simMode === "battle"
                      ? "Stored preference. Battle v1 still uses seeded combat variation and records combat events."
                      : simMode === "race" ? "Stored preference. Race v1 uses only its bounded seeded variability setting below."
                      : simMode === "survival" ? "Stored preference. Survival v1 uses the explicit seeded hazard and variability settings below."
                      : "Stored preference for a future execution module."}</span>
                  </div>
                  <Switch
                    id="sim-random-events"
                    checked={general.randomEvents}
                    onCheckedChange={(v) => setGeneral({ ...general, randomEvents: v })}
                  />
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="sim-allow-ties" className="block text-sm font-medium text-foreground">
                      Allow ties
                    </label>
                    <span className="block text-xs text-muted">{simMode === "race" || simMode === "survival"
                      ? `${simMode === "race" ? "Race" : "Survival"} v1 always preserves exact authoritative ties.`
                      : "Whether a tie is an acceptable outcome."}</span>
                  </div>
                  <Switch
                    id="sim-allow-ties"
                    checked={general.allowTies}
                    onCheckedChange={(v) => setGeneral({ ...general, allowTies: v })}
                  />
                </div>
              </div>

              <ModeSettings mode={simMode} value={modeConfig} onChange={setModeConfig} />
            </div>
          ) : null}

          {/* STEP 4 — ENVIRONMENT (placeholder only) */}
          {step === 4 ? (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>World Blueprint version</CardTitle>
                  <CardDescription>Optional. Every new Run freezes the selected immutable version in its input snapshot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Environment" htmlFor="sim-world" error={errors.worldId} hint="Later World edits never rewrite this selection or historical Runs.">
                    <Select id="sim-world" value={worldBinding} onChange={(event) => setWorldBinding(event.target.value)}>
                      <option value="">No World Blueprint</option>
                      {worlds.map((world) => (
                        <option key={`${world.worldId}:${world.version}`} value={`${world.worldId}::${world.version}`}>
                          {world.worldName} · v{world.version}{world.current ? " (current)" : ""} · {world.biome.replaceAll("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {worlds.length === 0 ? <p className="text-sm text-muted">No active Worlds are available. This Simulation can remain unbound.</p> : null}
                  <Link href="/worlds" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    <Globe2 className="size-4" />Open World Library
                  </Link>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* STEP 5 — PRESENTATION */}
          {step === 5 ? (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Experience Profile version</CardTitle>
                  <CardDescription>Optional. Chooses how authoritative events should be presented; it never changes simulation outcomes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Experience direction" htmlFor="sim-experience" error={errors.experienceProfileId} hint="Every new Run freezes the selected immutable Profile version.">
                    <Select id="sim-experience" value={experienceBinding} onChange={(event) => setExperienceBinding(event.target.value)}>
                      <option value="">Default runtime presentation</option>
                      {experiences.filter((profile) => profile.modeCompatibility.includes(simMode)).map((profile) => (
                        <option key={`${profile.experienceProfileId}:${profile.version}`} value={`${profile.experienceProfileId}::${profile.version}`}>
                          {profile.experienceProfileName} · v{profile.version}{profile.current ? " (current)" : ""} · {profile.preset.replaceAll("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Link href="/experiences" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                    <Aperture className="size-4" />Open Experience Library
                  </Link>
                </CardContent>
              </Card>
              <Field
                label="Display title"
                htmlFor="sim-display-title"
                error={errors["presentation.displayTitle"]}
                hint="Optional. Overrides the name in presentation views. Leave blank to use the name."
              >
                <Input
                  id="sim-display-title"
                  value={presentation.displayTitle ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setPresentation({ ...presentation, displayTitle: e.target.value.trim() ? e.target.value : null })
                  }
                  placeholder={name || "Simulation title"}
                />
              </Field>

              <Field
                label="Theme color"
                htmlFor="sim-theme-color"
                error={errors["presentation.themeColor"]}
                hint="Optional. A 6-digit hex color, e.g. #22D3EE."
              >
                <div className="flex items-center gap-3">
                  <span
                    className="size-9 shrink-0 rounded-lg border border-border-strong"
                    style={{ backgroundColor: presentation.themeColor ?? "transparent" }}
                    aria-hidden="true"
                  />
                  <Input
                    id="sim-theme-color"
                    value={presentation.themeColor ?? ""}
                    onChange={(e) =>
                      setPresentation({ ...presentation, themeColor: e.target.value.trim() ? e.target.value : null })
                    }
                    invalid={Boolean(errors["presentation.themeColor"])}
                    placeholder="#22D3EE"
                    className="max-w-48 font-mono"
                  />
                </div>
              </Field>

              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="sim-show-labels" className="block text-sm font-medium text-foreground">
                      Show labels
                    </label>
                    <span className="block text-xs text-muted">Display entity names in presentation views.</span>
                  </div>
                  <Switch
                    id="sim-show-labels"
                    checked={presentation.showLabels}
                    onCheckedChange={(v) => setPresentation({ ...presentation, showLabels: v })}
                  />
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label htmlFor="sim-show-leaderboard" className="block text-sm font-medium text-foreground">
                      Show leaderboard
                    </label>
                    <span className="block text-xs text-muted">Display a standings panel.</span>
                  </div>
                  <Switch
                    id="sim-show-leaderboard"
                    checked={presentation.showLeaderboard}
                    onCheckedChange={(v) => setPresentation({ ...presentation, showLeaderboard: v })}
                  />
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Presentation settings are stored separately from the simulation’s logic. Cameras, renderers and
                direction are out of scope until a later phase.
              </p>
            </div>
          ) : null}

          {/* STEP 6 — SEED */}
          {step === 6 ? (
            <div className="space-y-5">
              <p className="flex items-start gap-2 text-sm text-secondary">
                <Info className="mt-0.5 size-4 shrink-0 text-muted" />
                {simMode === "battle"
                  ? "A seed is a readable label (SV-XXXXXXXX). Battle v1 uses it for deterministic initiative and combat decisions."
                  : simMode === "race"
                    ? "A seed is a readable label (SV-XXXXXXXX). Race v1 uses it for deterministic bounded variability."
                    : simMode === "survival"
                      ? "A seed is a readable label (SV-XXXXXXXX). Survival v1 uses it for deterministic hazards and variability."
                      : "A seed is a readable label (SV-XXXXXXXX) stored for reproducibility when this mode gains an execution module."}
              </p>

              <div className="space-y-2">
                {id && currentSeed ? (
                  <SeedOption
                    checked={seedMode === "keep"}
                    onSelect={() => setSeedMode("keep")}
                    title="Keep current seed"
                    detail={<span className="font-mono text-foreground">{currentSeed}</span>}
                  />
                ) : null}

                <SeedOption
                  checked={seedMode === "auto"}
                  onSelect={() => setSeedMode("auto")}
                  title={id && currentSeed ? "Generate a new seed" : "Generate automatically"}
                  detail="A fresh valid seed is assigned when you save."
                />

                <SeedOption
                  checked={seedMode === "custom"}
                  onSelect={() => setSeedMode("custom")}
                  title="Custom seed"
                  detail="Enter your own SV- label."
                >
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      value={customSeed}
                      onChange={(e) => setCustomSeed(e.target.value.toUpperCase())}
                      placeholder="SV-ABCD2345"
                      className="max-w-56 font-mono"
                      invalid={Boolean(errors.seed) || (customSeed.length > 0 && !isValidSeed(normalizeSeed(customSeed)))}
                      aria-label="Custom seed"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCustomSeed(generateSeed())}
                      title="Generate a random seed to edit"
                    >
                      <RefreshCw className="size-4" />
                      Random
                    </Button>
                  </div>
                  {customSeed.length > 0 && !isValidSeed(normalizeSeed(customSeed)) ? (
                    <p className="mt-1.5 text-xs font-medium text-danger">
                      Seed must look like SV-XXXXXXXX (8 letters or digits).
                    </p>
                  ) : null}
                  {errors.seed ? <p className="mt-1.5 text-xs font-medium text-danger">{errors.seed}</p> : null}
                </SeedOption>
              </div>
            </div>
          ) : null}

          {/* STEP 7 — REVIEW */}
          {step === LAST_STEP ? (
            <div className="space-y-6">
              {isAnythingWars ? (
                <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">Anything Wars</p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-foreground">Ready to start</h3>
                  <p className="mt-1 text-sm text-secondary">Review the competitors, World, presentation, seed, and authoritative rules before launching.</p>
                </div>
              ) : null}
              <div className="rounded-xl border border-border bg-surface">
                <ReviewRow label="Name" value={name.trim() || "—"} onEdit={() => setStep(0)} />
                <ReviewRow
                  label="Project"
                  value={projectOptions.find((p) => p.id === projectId)?.name ?? "—"}
                  onEdit={() => setStep(0)}
                />
                <ReviewRow label="Mode" value={resolvedMode.label} onEdit={() => setStep(1)} />
                <ReviewRow
                  label={isAnythingWars ? "Competitors" : "Participants"}
                  value={`${participants.length} ${isAnythingWars ? (participants.length === 1 ? "competitor" : "competitors") : (participants.length === 1 ? "entity" : "entities")}`}
                  onEdit={() => setStep(2)}
                />
                <ReviewRow
                  label="Settings"
                  value={`${SIMULATION_SPEED_LABELS[general.speed]} · ${SIMULATION_DIFFICULTY_META[general.difficulty].label}${general.roundLimit ? ` · limit ${general.roundLimit}` : ""}`}
                  onEdit={() => setStep(3)}
                />
                <ReviewRow
                  label="World"
                  value={worldBinding ? (() => {
                    const [worldId, version] = worldBinding.split("::");
                    const selected = worlds.find((world) => world.worldId === worldId && String(world.version) === version);
                    return selected ? `${selected.worldName} · v${selected.version}` : `Pinned World · v${version}`;
                  })() : "No World"}
                  onEdit={() => setStep(4)}
                />
                <ReviewRow
                  label={isAnythingWars ? "Presentation style" : "Experience"}
                  value={experienceBinding ? (() => {
                    const [profileId, version] = experienceBinding.split("::");
                    const selected = experiences.find((profile) => profile.experienceProfileId === profileId && String(profile.version) === version);
                    return selected ? `${selected.experienceProfileName} · v${selected.version}` : `Pinned Experience · v${version}`;
                  })() : "Default runtime presentation"}
                  onEdit={() => setStep(5)}
                />
                <ReviewRow
                  label="Seed"
                  value={
                    seedMode === "custom"
                      ? normalizeSeed(customSeed) || "—"
                      : seedMode === "keep"
                        ? currentSeed || "—"
                        : "Auto on save"
                  }
                  onEdit={() => setStep(6)}
                  mono
                />
              </div>

              {isAnythingWars && participants.length ? (
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Competitor cards</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {participants.map((participant, index) => (
                      <div key={participant.entityId} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background text-sm font-semibold text-accent">
                          {participant.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={participant.imageUrl} alt="" className="size-full object-cover" />
                          ) : index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
                          <p className="truncate text-xs text-muted">{participant.category.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Readiness checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Readiness</h4>
                <ul className="space-y-1.5">
                  {checklist.map((c) => (
                    <li key={c.label}>
                      <button
                        type="button"
                        onClick={() => setStep(c.step)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover"
                      >
                        {c.ok ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted" />
                        )}
                        <span className={c.ok ? "text-secondary" : "text-foreground"}>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {readyIssues.length > 0 ? (
                <div className="rounded-xl border border-danger/30 bg-danger-soft p-4">
                  <p className="text-sm font-medium text-danger">This simulation isn’t ready yet:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
                    {readyIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex items-start gap-2 rounded-xl border border-accent/25 bg-accent-soft p-4 text-sm text-accent">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <span>
                  {isReady
                    ? isAnythingWars
                      ? "This event is complete and can create an immutable authoritative Run."
                      : "This blueprint is complete. Marking it ready records that its configuration is valid; execution depends on mode support."
                    : "Save your progress any time. You can mark it ready once the checklist is complete; execution depends on mode support."}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Footer: navigation + persistent save */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <span className="hidden sm:inline">
            Step {step + 1} / {STEPS.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href={isAnythingWars ? (id ? `/anything-wars/events/${id}` : "/anything-wars") : (id ? `/simulations/${id}` : "/simulations")} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Cancel
          </Link>

          {step < LAST_STEP ? (
            <>
              <Button variant="secondary" onClick={() => onSaveDraft(false)} loading={saving} disabled={markingReady}>
                {saving ? null : <Save className="size-4" />}
                Save draft
              </Button>
              <Button onClick={() => setStep((s) => Math.min(LAST_STEP, s + 1))} disabled={busy}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onSaveDraft(true)} loading={saving} disabled={markingReady}>
                {saving ? null : <Save className="size-4" />}
                Save as draft
              </Button>
              <Button onClick={onMarkReady} loading={markingReady} disabled={!isReady || saving || (isAnythingWars && !canRun)} title={isReady ? undefined : "Complete the checklist to mark ready"}>
                {markingReady ? null : <CheckCircle2 className="size-4" />}
                {isAnythingWars ? "Start War" : "Mark as ready"}
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted">
        {mode === "edit" ? "Editing an existing simulation." : id ? "Draft saved — keep configuring." : "Nothing is saved until you choose Save."}
      </p>
    </div>
  );
}

const STEP_BLURBS = [
  "Name your simulation and choose the project it belongs to.",
  "Pick how these entities compete. Execution availability depends on the mode.",
  "Choose which of the project’s entities take part. They’re referenced, never copied.",
  "Generic, mode-agnostic preferences. These are stored settings, not a rules engine.",
  "Where the simulation takes place — arriving in a later phase.",
  "How the simulation is presented. Stored separately from its logic.",
  "A reproducibility seed for supported execution modules.",
  "Review everything, then save a draft or mark it ready.",
] as const;

const ANYTHING_WARS_STEP_BLURBS = [
  "Name the event and choose the project that supplies its competitors.",
  "Choose Battle, Race, or Survival. Tournaments use their dedicated guided flow.",
  "Search and choose existing Entities as competitors. They remain canonical SIMVERSE Entities.",
  "Configure the existing authoritative mechanics module with friendly match controls.",
  "Optionally pin an immutable World Blueprint version as the event environment.",
  "Optionally pin an Experience Profile that directs presentation without changing outcomes.",
  "Choose the deterministic seed frozen into every new Run.",
  "Review the event, save a draft, or start an authoritative Run.",
] as const;

interface ModeSettingsProps {
  mode: string;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/** Mode-specific configuration consumed by registered execution modules. */
function ModeSettings({ mode, value, onChange }: ModeSettingsProps) {
  if (mode === "race") return <RaceSettings value={value} onChange={onChange} />;
  if (mode === "survival") return <SurvivalSettings value={value} onChange={onChange} />;
  const field = modeSettingField(mode);
  if (!field) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        This mode has no additional settings.
      </div>
    );
  }
  const current = typeof value[field.key] === "string" ? (value[field.key] as string) : field.options[0];
  return (
    <Field label={field.label} htmlFor={`sim-mode-${field.key}`} hint={mode === "battle"
      ? "Duel and free-for-all execute in Battle v1. Team execution is a future enhancement."
      : "A stored preference for this mode."}>
      <Select
        id={`sim-mode-${field.key}`}
        value={current}
        onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
      >
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {field.labels[opt] ?? opt}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function SurvivalSettings({ value, onChange }: Pick<ModeSettingsProps, "value" | "onChange">) {
  const parsed = survivalConfigV1Schema.safeParse(value);
  const config = parsed.success ? parsed.data : defaultSurvivalConfigV1();
  const patch = (next: Partial<SurvivalConfigV1>) => onChange({ ...config, ...next });
  const updateResource = (next: Partial<SurvivalConfigV1["resources"]>) => patch({
    resources: { ...config.resources, ...next },
  });
  const updateRecovery = (next: Partial<SurvivalConfigV1["recovery"]>) => patch({
    recovery: { ...config.recovery, ...next },
  });
  const updateMapping = (key: keyof SurvivalConfigV1["statMapping"], next: string) => patch({
    statMapping: {
      ...config.statMapping,
      [key]: next.trim().toLowerCase() || DEFAULT_SURVIVAL_STAT_MAPPING[key],
    },
  });
  const integer = (text: string, minimum: number, maximum: number): number | null => {
    const next = Number.parseInt(text, 10);
    return Number.isFinite(next) ? Math.max(minimum, Math.min(maximum, next)) : null;
  };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Survival v1 authority</p>
        <p className="mt-1 text-xs text-muted">Fixed ticks, frozen participant stats, explicit resources and seeded hazards determine outcomes. A pinned World remains presentation context.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Survival mode" htmlFor="survival-mode">
          <Select id="survival-mode" value={config.mode} onChange={(event) => patch({ mode: event.target.value as SurvivalConfigV1["mode"] })}>
            {SURVIVAL_MODES.map((item) => <option key={item} value={item}>{SURVIVAL_MODE_LABELS[item]}</option>)}
          </Select>
        </Field>
        <Field label="Maximum ticks" htmlFor="survival-max-ticks" hint={`100 ms fixed ticks; maximum ${SURVIVAL_MAX_TICKS.toLocaleString()}.`}>
          <Input id="survival-max-ticks" type="number" min="1" max={SURVIVAL_MAX_TICKS} value={config.maxTicks}
            onChange={(event) => { const next = integer(event.target.value, 1, SURVIVAL_MAX_TICKS); if (next !== null) patch({ maxTicks: next }); }} />
        </Field>
        <Field label="Condition drain" htmlFor="survival-condition-drain" hint="Base fixed-point loss per tick before Endurance reduction.">
          <Input id="survival-condition-drain" type="number" min="0" max={SURVIVAL_MAX_DRAIN} value={config.baseConditionDrain}
            onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_MAX_DRAIN); if (next !== null) patch({ baseConditionDrain: next }); }} />
        </Field>
        <Field label="Elimination threshold" htmlFor="survival-threshold" hint={`Condition at or below this value is terminal; maximum ${(SURVIVAL_CONDITION_MAX - 1).toLocaleString()}.`}>
          <Input id="survival-threshold" type="number" min="0" max={SURVIVAL_CONDITION_MAX - 1} value={config.eliminationThreshold}
            onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_CONDITION_MAX - 1); if (next !== null) patch({ eliminationThreshold: next }); }} />
        </Field>
        <Field label="Hazard frequency" htmlFor="survival-hazard-frequency" hint="0–100 percent chance per tick.">
          <Input id="survival-hazard-frequency" type="number" min="0" max="100" value={config.hazardFrequency}
            onChange={(event) => { const next = integer(event.target.value, 0, 100); if (next !== null) patch({ hazardFrequency: next, hazardIntensity: next > 0 && config.hazardIntensity === 0 ? 1 : config.hazardIntensity }); }} />
        </Field>
        <Field label="Hazard intensity" htmlFor="survival-hazard-intensity" hint="0–100; must be positive while hazards are enabled.">
          <Input id="survival-hazard-intensity" type="number" min={config.hazardFrequency > 0 ? 1 : 0} max="100" value={config.hazardIntensity}
            onChange={(event) => { const next = integer(event.target.value, config.hazardFrequency > 0 ? 1 : 0, 100); if (next !== null) patch({ hazardIntensity: next }); }} />
        </Field>
        <Field label="Seeded variability" htmlFor="survival-variability" hint="0–100 intensity; primary stats remain decisive.">
          <Input id="survival-variability" type="number" min="0" max="100" value={config.variability}
            onChange={(event) => { const next = integer(event.target.value, 0, 100); if (next !== null) patch({ variability: next }); }} />
        </Field>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Resources</p>
        <p className="mt-1 text-xs text-muted">Energy and supplies are abstract integer resources. Depletion increases condition loss; it does not directly eliminate a participant.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Initial energy" htmlFor="survival-initial-energy">
            <Input id="survival-initial-energy" type="number" min="0" max={SURVIVAL_RESOURCE_MAX} value={config.resources.initialEnergy}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_RESOURCE_MAX); if (next !== null) updateResource({ initialEnergy: next }); }} />
          </Field>
          <Field label="Initial supplies" htmlFor="survival-initial-supplies">
            <Input id="survival-initial-supplies" type="number" min="0" max={SURVIVAL_RESOURCE_MAX} value={config.resources.initialSupplies}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_RESOURCE_MAX); if (next !== null) updateResource({ initialSupplies: next }); }} />
          </Field>
          <Field label="Energy drain" htmlFor="survival-energy-drain">
            <Input id="survival-energy-drain" type="number" min="1" max={SURVIVAL_MAX_DRAIN} value={config.resources.baseEnergyDrain}
              onChange={(event) => { const next = integer(event.target.value, 1, SURVIVAL_MAX_DRAIN); if (next !== null) updateResource({ baseEnergyDrain: next }); }} />
          </Field>
          <Field label="Supplies drain" htmlFor="survival-supplies-drain">
            <Input id="survival-supplies-drain" type="number" min="1" max={SURVIVAL_MAX_DRAIN} value={config.resources.baseSuppliesDrain}
              onChange={(event) => { const next = integer(event.target.value, 1, SURVIVAL_MAX_DRAIN); if (next !== null) updateResource({ baseSuppliesDrain: next }); }} />
          </Field>
          <Field label="Depletion condition penalty" htmlFor="survival-depletion-penalty" hint="Applied per exhausted resource on each tick.">
            <Input id="survival-depletion-penalty" type="number" min="0" max={SURVIVAL_MAX_DEPLETION_PENALTY} value={config.resources.depletionConditionPenalty}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_MAX_DEPLETION_PENALTY); if (next !== null) updateResource({ depletionConditionPenalty: next }); }} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Recovery</p>
        <p className="mt-1 text-xs text-muted">Eligible active participants recover at the interval by consuming configured resources.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Recovery amount" htmlFor="survival-recovery-amount">
            <Input id="survival-recovery-amount" type="number" min="0" max={SURVIVAL_MAX_RECOVERY} value={config.recovery.amount}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_MAX_RECOVERY); if (next !== null) updateRecovery({ amount: next }); }} />
          </Field>
          <Field label="Interval (ticks)" htmlFor="survival-recovery-interval">
            <Input id="survival-recovery-interval" type="number" min="1" max={SURVIVAL_MAX_RECOVERY_INTERVAL} value={config.recovery.intervalTicks}
              onChange={(event) => { const next = integer(event.target.value, 1, SURVIVAL_MAX_RECOVERY_INTERVAL); if (next !== null) updateRecovery({ intervalTicks: next }); }} />
          </Field>
          <Field label="Energy cost" htmlFor="survival-recovery-energy">
            <Input id="survival-recovery-energy" type="number" min="0" max={SURVIVAL_MAX_DRAIN} value={config.recovery.energyCost}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_MAX_DRAIN); if (next !== null) updateRecovery({ energyCost: next }); }} />
          </Field>
          <Field label="Supplies cost" htmlFor="survival-recovery-supplies">
            <Input id="survival-recovery-supplies" type="number" min="0" max={SURVIVAL_MAX_DRAIN} value={config.recovery.suppliesCost}
              onChange={(event) => { const next = integer(event.target.value, 0, SURVIVAL_MAX_DRAIN); if (next !== null) updateRecovery({ suppliesCost: next }); }} />
          </Field>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Entity stat mapping</p>
        <p className="mt-1 text-xs text-muted">Each key resolves one frozen NUMBER attribute. Missing attributes default to 50; present values round and clamp to 0–100.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(DEFAULT_SURVIVAL_STAT_MAPPING) as Array<keyof SurvivalConfigV1["statMapping"]>).map((key) => (
            <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())} htmlFor={`survival-stat-${key}`}>
              <Input id={`survival-stat-${key}`} value={config.statMapping[key]} onChange={(event) => updateMapping(key, event.target.value)} />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function RaceSettings({ value, onChange }: Pick<ModeSettingsProps, "value" | "onChange">) {
  const parsed = raceConfigV1Schema.safeParse(value);
  const config = parsed.success ? parsed.data : defaultRaceConfigV1();
  const patch = (next: Partial<RaceConfigV1>) => onChange({ ...config, ...next });
  const updateMapping = (key: keyof RaceConfigV1["statMapping"], next: string) => patch({
    statMapping: { ...config.statMapping, [key]: next.trim().toLowerCase() || DEFAULT_RACE_STAT_MAPPING[key] },
  });
  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Race v1 authority</p>
        <p className="mt-1 text-xs text-muted">Distance, fixed ticks, frozen participant stats and seeded variability determine progress. A pinned World remains presentation context.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Race mode" htmlFor="race-mode">
          <Select id="race-mode" value={config.mode} onChange={(event) => {
            const next = event.target.value as RaceConfigV1["mode"];
            patch({ mode: next, laps: next === "SPRINT" ? 1 : Math.max(2, config.laps) });
          }}>
            {RACE_MODES.map((item) => <option key={item} value={item}>{RACE_MODE_LABELS[item]}</option>)}
          </Select>
        </Field>
        <Field label="Course distance" htmlFor="race-distance" hint="Up to three decimal places.">
          <Input id="race-distance" type="number" min="0.001" max={RACE_MAX_DISTANCE} step="0.001" value={config.distance}
            onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next) && next > 0) patch({ distance: Math.min(RACE_MAX_DISTANCE, next) }); }} />
        </Field>
        <Field label="Distance unit" htmlFor="race-distance-unit">
          <Select id="race-distance-unit" value={config.distanceUnit} onChange={(event) => patch({ distanceUnit: event.target.value as RaceConfigV1["distanceUnit"] })}>
            {RACE_DISTANCE_UNITS.map((item) => <option key={item} value={item}>{RACE_DISTANCE_UNIT_LABELS[item]}</option>)}
          </Select>
        </Field>
        <Field label="Laps" htmlFor="race-laps" hint={config.mode === "SPRINT" ? "Sprint uses exactly one lap." : `Circuit supports 2–${RACE_MAX_LAPS} laps.`}>
          <Input id="race-laps" type="number" min={config.mode === "SPRINT" ? 1 : 2} max={RACE_MAX_LAPS} value={config.laps} disabled={config.mode === "SPRINT"}
            onChange={(event) => { const next = Number.parseInt(event.target.value, 10); if (Number.isFinite(next)) patch({ laps: Math.max(2, Math.min(RACE_MAX_LAPS, next)) }); }} />
        </Field>
        <Field label="Maximum ticks" htmlFor="race-max-ticks" hint={`100 ms fixed ticks; maximum ${RACE_MAX_TICKS.toLocaleString()}.`}>
          <Input id="race-max-ticks" type="number" min="1" max={RACE_MAX_TICKS} value={config.maxTicks}
            onChange={(event) => { const next = Number.parseInt(event.target.value, 10); if (Number.isFinite(next)) patch({ maxTicks: Math.max(1, Math.min(RACE_MAX_TICKS, next)) }); }} />
        </Field>
        <Field label="Seeded variability" htmlFor="race-variability" hint="0–100 intensity; skill remains primary.">
          <Input id="race-variability" type="number" min="0" max="100" value={config.variability}
            onChange={(event) => { const next = Number.parseInt(event.target.value, 10); if (Number.isFinite(next)) patch({ variability: Math.max(0, Math.min(100, next)) }); }} />
        </Field>
      </div>
      <Field label="Checkpoint percentages" htmlFor="race-checkpoints" hint={`Comma-separated whole percentages from 1–99; maximum ${RACE_MAX_CHECKPOINTS}. Each lap uses the same checkpoints.`}>
        <Input id="race-checkpoints" value={config.checkpoints.join(", ")} placeholder={DEFAULT_RACE_CHECKPOINTS.join(", ")}
          onChange={(event) => {
            const checkpoints = event.target.value.split(",").map((item) => Number.parseInt(item.trim(), 10))
              .filter((item) => Number.isInteger(item) && item >= 1 && item <= 99).slice(0, RACE_MAX_CHECKPOINTS);
            patch({ checkpoints: [...new Set(checkpoints)].sort((a, b) => a - b) });
          }} />
      </Field>
      <div>
        <p className="text-sm font-medium text-foreground">Entity stat mapping</p>
        <p className="mt-1 text-xs text-muted">Each key resolves one frozen NUMBER attribute. Missing attributes default to 50; present values round and clamp to 0–100.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(DEFAULT_RACE_STAT_MAPPING) as Array<keyof RaceConfigV1["statMapping"]>).map((key) => (
            <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} htmlFor={`race-stat-${key}`}>
              <Input id={`race-stat-${key}`} value={config.statMapping[key]} onChange={(event) => updateMapping(key, event.target.value)} />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function modeSettingField(
  mode: string,
): { key: string; label: string; options: readonly string[]; labels: Record<string, string> } | null {
  switch (mode) {
    case "battle":
      return { key: "format", label: "Battle format", options: BATTLE_FORMATS, labels: BATTLE_FORMAT_LABELS };
    case "tournament":
      return { key: "format", label: "Tournament format", options: TOURNAMENT_FORMATS, labels: TOURNAMENT_FORMAT_LABELS };
    default:
      return null;
  }
}

interface SeedOptionProps {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: React.ReactNode;
  children?: React.ReactNode;
}

function SeedOption({ checked, onSelect, title, detail, children }: SeedOptionProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-colors",
        checked ? "border-accent ring-1 ring-accent" : "border-border-strong",
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <span
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
            checked ? "border-accent" : "border-border-strong",
          )}
          aria-hidden="true"
        >
          {checked ? <span className="size-2 rounded-full bg-accent" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-xs text-muted">{detail}</span>
        </span>
      </button>
      {checked ? children : null}
    </div>
  );
}

interface ReviewRowProps {
  label: string;
  value: string;
  onEdit: () => void;
  mono?: boolean;
}

function ReviewRow({ label, value, onEdit, mono }: ReviewRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className={cn("truncate text-sm text-foreground", mono && "font-mono")}>{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-xs font-medium text-accent hover:underline">
        Edit
      </button>
    </div>
  );
}
