import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Aperture,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  FolderKanban,
  Globe2,
  Hash,
  Info,
  Palette,
  Pencil,
  Rocket,
  Settings2,
  Sparkles,
  User as UserIcon,
  Users,
} from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { productionEngineRegistry } from "@/lib/engine/registry";
import { battleExecutionIssue, DEFAULT_BATTLE_MAX_TICKS, MAX_BATTLE_TICKS } from "@/lib/modules/battle/config";
import {
  RACE_DISTANCE_UNIT_LABELS, RACE_MODE_LABELS, raceConfigV1Schema, raceExecutionIssue,
} from "@/lib/modules/race/config";
import {
  SURVIVAL_MODE_LABELS, survivalConfigV1Schema, survivalExecutionIssue,
} from "@/lib/modules/survival/config";
import { resolveCategory } from "@/lib/entities/categories";
import { resolveMode } from "@/lib/simulations/modes";
import { SIMULATION_STATUS_META } from "@/lib/simulations/constants";
import {
  BATTLE_FORMAT_LABELS,
  SIMULATION_DIFFICULTY_META,
  SIMULATION_SPEED_LABELS,
  TOURNAMENT_FORMAT_LABELS,
  type SimulationConfigV1,
} from "@/lib/simulations/config";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import {
  getSimulation,
  type SimulationParticipantView,
  type SimulationView,
} from "@/server/services/simulation-service";
import { listSimulationRuns } from "@/server/services/simulation-run-service";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationActions } from "@/components/simulations/simulation-actions";
import { BattleRunControls } from "@/components/battle/battle-run-controls";
import { RaceRunControls } from "@/components/race/race-run-controls";
import { SurvivalRunControls } from "@/components/survival/survival-run-controls";

interface PageParams {
  params: Promise<{ simulationId: string }>;
}

/** Load a simulation, translating a service NotFoundError into a real 404. */
async function loadSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  try {
    return await getSimulation(userId, workspaceId, simulationId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { simulationId } = await params;
  try {
    const { user, workspace } = await requirePlatformContext();
    const simulation = await getSimulation(user.id, workspace.id, simulationId);
    return { title: simulation.name };
  } catch {
    return { title: "Simulation" };
  }
}

/** Human-readable rows for the mode-agnostic general settings. */
function generalSettingRows(config: SimulationConfigV1, mode: string): { label: string; value: string }[] {
  const g = config.general;
  const rows = [
    { label: "Speed", value: SIMULATION_SPEED_LABELS[g.speed] ?? g.speed },
    { label: "Difficulty", value: SIMULATION_DIFFICULTY_META[g.difficulty]?.label ?? g.difficulty },
    { label: "Round limit", value: g.roundLimit == null
      ? mode === "battle" ? `Default (${DEFAULT_BATTLE_MAX_TICKS} Battle ticks)` : "No limit"
      : g.roundLimit.toLocaleString() },
    { label: "Random events", value: g.randomEvents ? "Enabled" : "Disabled" },
    { label: "Ties", value: g.allowTies ? "Allowed" : "Not allowed" },
  ];
  if (mode === "battle") rows.push({ label: "Battle v1 tick limit", value: String(Math.min(g.roundLimit ?? DEFAULT_BATTLE_MAX_TICKS, MAX_BATTLE_TICKS)) });
  return rows;
}

/**
 * Human-readable rows for mode-specific settings. Registered modules decide
 * which settings affect execution.
 */
function modeSettingRows(mode: string, config: Record<string, unknown>): { label: string; value: string }[] {
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  switch (mode) {
    case "battle": {
      const v = str(config.format);
      return v ? [{ label: "Format", value: BATTLE_FORMAT_LABELS[v as keyof typeof BATTLE_FORMAT_LABELS] ?? v }] : [];
    }
    case "race": {
      const parsed = raceConfigV1Schema.safeParse(config);
      if (!parsed.success) return [];
      const race = parsed.data;
      return [
        { label: "Race mode", value: RACE_MODE_LABELS[race.mode] },
        { label: "Course distance", value: `${race.distance.toLocaleString()} ${RACE_DISTANCE_UNIT_LABELS[race.distanceUnit]}` },
        { label: "Laps", value: String(race.laps) },
        { label: "Maximum ticks", value: race.maxTicks.toLocaleString() },
        { label: "Seeded variability", value: `${race.variability}%` },
        { label: "Checkpoints", value: race.checkpoints.length ? race.checkpoints.map((checkpoint) => `${checkpoint}%`).join(", ") : "None" },
        { label: "Stat mapping", value: Object.entries(race.statMapping).map(([stat, key]) => `${stat}: ${key}`).join(" · ") },
      ];
    }
    case "tournament": {
      const v = str(config.format);
      return v
        ? [{ label: "Format", value: TOURNAMENT_FORMAT_LABELS[v as keyof typeof TOURNAMENT_FORMAT_LABELS] ?? v }]
        : [];
    }
    case "survival": {
      const parsed = survivalConfigV1Schema.safeParse(config);
      if (!parsed.success) return [];
      const survival = parsed.data;
      return [
        { label: "Survival mode", value: SURVIVAL_MODE_LABELS[survival.mode] },
        { label: "Maximum ticks", value: survival.maxTicks.toLocaleString() },
        { label: "Condition drain", value: survival.baseConditionDrain.toLocaleString() },
        { label: "Elimination threshold", value: survival.eliminationThreshold.toLocaleString() },
        { label: "Hazards", value: `${survival.hazardFrequency}% frequency · ${survival.hazardIntensity} intensity` },
        { label: "Seeded variability", value: `${survival.variability}%` },
        { label: "Initial resources", value: `${survival.resources.initialEnergy.toLocaleString()} energy · ${survival.resources.initialSupplies.toLocaleString()} supplies` },
        { label: "Resource drain", value: `${survival.resources.baseEnergyDrain.toLocaleString()} energy · ${survival.resources.baseSuppliesDrain.toLocaleString()} supplies per tick` },
        { label: "Recovery", value: `${survival.recovery.amount.toLocaleString()} every ${survival.recovery.intervalTicks} ticks for ${survival.recovery.energyCost} energy + ${survival.recovery.suppliesCost} supplies` },
        { label: "Stat mapping", value: Object.entries(survival.statMapping).map(([stat, key]) => `${stat}: ${key}`).join(" · ") },
      ];
    }
    default:
      return [];
  }
}

export default async function SimulationDetailPage({ params }: PageParams) {
  const { simulationId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const simulation = await loadSimulation(user.id, workspace.id, simulationId);
  const runs = await listSimulationRuns(user.id, workspace.id, simulationId);

  const mode = resolveMode(simulation.mode);
  const ModeIcon = mode.icon;
  const statusMeta = SIMULATION_STATUS_META[simulation.status];
  const isArchived = simulation.status === "ARCHIVED";
  const isReady = simulation.status === "READY";
  const executionAvailable = productionEngineRegistry.canExecute(simulation.mode);
  const canEdit = permissions.includes("simulation.edit");

  const battleIssue = simulation.mode === "battle"
    ? battleExecutionIssue(simulation.configuration.mode.format, simulation.participants.length) : null;
  const raceIssue = simulation.mode === "race"
    ? raceExecutionIssue(simulation.configuration.mode, simulation.participants.length) : null;
  const survivalIssue = simulation.mode === "survival"
    ? survivalExecutionIssue(simulation.configuration.mode, simulation.participants.length) : null;
  const executionIssue = battleIssue ?? raceIssue ?? survivalIssue;
  const canRun = isReady && executionAvailable && !executionIssue && permissions.includes("simulation.run");
  const raceConfig = simulation.mode === "race" ? raceConfigV1Schema.safeParse(simulation.configuration.mode) : null;
  const survivalConfig = simulation.mode === "survival" ? survivalConfigV1Schema.safeParse(simulation.configuration.mode) : null;
  const generalRows = generalSettingRows(simulation.configuration, simulation.mode);
  const modeRows = modeSettingRows(simulation.mode, simulation.configuration.mode);
  const presentation = simulation.presentation;

  return (
    <div className="space-y-6">
      <Link
        href="/simulations"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Simulations
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-border-strong bg-background/60 text-accent">
            <ModeIcon className="size-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
              <Badge variant="outline">{simulation.modeLabel}</Badge>
            </div>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">
              {simulation.name}
            </h1>
            {simulation.projectName ? (
              <Link
                href={`/projects/${simulation.projectId}`}
                className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
              >
                <FolderKanban className="size-3.5" />
                {simulation.projectName}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && !isArchived ? (
            <Link
              href={`/simulations/${simulation.id}/edit`}
              className={buttonClasses({ variant: "secondary" })}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
          ) : null}
          <SimulationActions
            simulation={{ id: simulation.id, name: simulation.name, status: simulation.status }}
            permissions={permissions}
            showView={false}
            navigateOnDuplicate
          />
        </div>
      </div>

      {/* Configuration readiness and execution availability are separate. */}
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4">
        <Rocket className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">
            {!isReady ? "This configuration is not ready yet." : executionIssue
              ? `${mode.label} execution is not available for this configuration.`
              : executionAvailable ? "This mode supports execution." : `${mode.label} execution is not available yet.`}
          </p>
          <p className="mt-0.5 text-secondary">
            {!isReady
              ? "Set up the mode, participants and settings, then mark this configuration ready."
              : executionIssue ? executionIssue
              : executionAvailable
                ? simulation.mode === "battle"
                  ? "Battle v1 uses your saved participants and settings. Runs keep an immutable snapshot."
                  : simulation.mode === "race"
                    ? "Race v1 uses fixed ticks, the saved seed and immutable participant snapshots."
                    : simulation.mode === "survival"
                      ? "Survival v1 uses fixed ticks, explicit resources, the saved seed and immutable participant snapshots."
                  : "Run history and execution details appear below."
                : "The Core engine is in place. This mode needs its execution module before you can run it."}
          </p>
          {canRun && simulation.mode === "battle" ? <div className="mt-3"><BattleRunControls simulationId={simulation.id} /></div> : null}
          {canRun && simulation.mode === "race" && raceConfig?.success ? <div className="mt-3"><RaceRunControls simulationId={simulation.id} maxTicks={raceConfig.data.maxTicks} /></div> : null}
          {canRun && simulation.mode === "survival" && survivalConfig?.success ? <div className="mt-3"><SurvivalRunControls simulationId={simulation.id} maxTicks={survivalConfig.data.maxTicks} /></div> : null}
          {isReady && executionAvailable && !executionIssue && !permissions.includes("simulation.run") ? (
            <p className="mt-2 text-xs text-muted">Your workspace role can view this {mode.label} but cannot start runs.</p>
          ) : null}
        </div>
      </div>

      <Card as="section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted" />
            Run history
            <span className="text-sm font-normal text-muted">({runs.total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.items.length === 0 ? (
            <p className="text-sm text-muted">No runs have been recorded for this simulation.</p>
          ) : (
            <ol className="space-y-2">
              {runs.items.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/simulations/${simulation.id}/runs/${run.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/40 p-3 transition-colors hover:border-accent/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "danger" : "neutral"}>
                        {run.status}
                      </Badge>
                      <span className="truncate text-sm font-medium text-foreground">Run {run.id.slice(-8)}</span>
                    </span>
                    <span className="text-xs text-muted">Tick {run.currentTick} · {formatRelativeTime(run.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {simulation.description ? (
            <Card as="section">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                  {simulation.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {/* Participants */}
          <Card as="section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-muted" />
                Participants
                <span className="text-sm font-normal text-muted">({simulation.participants.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {simulation.participants.length === 0 ? (
                <p className="text-sm text-muted">
                  No participants selected yet. Add at least {mode.minEntities} to mark this simulation ready.
                </p>
              ) : (
                <ol className="space-y-2">
                  {simulation.participants.map((participant) => (
                    <ParticipantRow key={participant.entityId} participant={participant} />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Rules & settings */}
          <Card as="section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-4 text-muted" />
                Rules &amp; settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <SettingGrid rows={generalRows} />
              {modeRows.length > 0 ? (
                <div className="border-t border-border pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                    {mode.label} settings
                  </p>
                  <SettingGrid rows={modeRows} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Presentation */}
          <Card as="section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-4 text-muted" />
                Presentation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MetaRow
                icon={Sparkles}
                label="Display title"
                value={presentation.displayTitle ?? simulation.name}
              />
              <div className="flex items-start gap-2.5">
                <Palette className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-muted">Theme color</p>
                  {presentation.themeColor ? (
                    <p className="flex items-center gap-2 font-mono text-secondary">
                      <span
                        className="size-4 shrink-0 rounded border border-border-strong"
                        style={{ backgroundColor: presentation.themeColor }}
                        aria-hidden
                      />
                      {presentation.themeColor}
                    </p>
                  ) : (
                    <p className="text-secondary">Default</p>
                  )}
                </div>
              </div>
              <MetaRow icon={Info} label="Labels" value={presentation.showLabels ? "Shown" : "Hidden"} />
              <MetaRow
                icon={Info}
                label="Leaderboard"
                value={presentation.showLeaderboard ? "Shown" : "Hidden"}
              />
            </CardContent>
          </Card>

          {/* Details */}
          <Card as="section">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Hash className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-muted">Seed</p>
                  <p className="truncate font-mono text-secondary">{simulation.seed ?? "—"}</p>
                </div>
              </div>
              <MetaRow icon={ModeIcon} label="Mode" value={simulation.modeLabel} />
              {simulation.worldId && simulation.worldVersion ? (
                <div className="flex items-start gap-2.5">
                  <Globe2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0"><p className="text-xs text-muted">World</p><Link href={`/worlds/${simulation.worldId}`} className="text-secondary hover:text-accent">{simulation.worldName ?? "World"} · v{simulation.worldVersion}</Link></div>
                </div>
              ) : <MetaRow icon={Globe2} label="World" value="No World Blueprint" />}
              {simulation.experienceProfileId && simulation.experienceProfileVersion ? (
                <div className="flex items-start gap-2.5">
                  <Aperture className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0"><p className="text-xs text-muted">Experience Profile</p><Link href={`/experiences/${simulation.experienceProfileId}`} className="text-secondary hover:text-accent">{simulation.experienceProfileName ?? "Experience Profile"} · v{simulation.experienceProfileVersion}</Link></div>
                </div>
              ) : <MetaRow icon={Aperture} label="Experience Profile" value="Default runtime presentation" />}
              {simulation.createdByName ? (
                <MetaRow icon={UserIcon} label="Created by" value={simulation.createdByName} />
              ) : null}
              <MetaRow icon={CalendarPlus} label="Created" value={formatRelativeTime(simulation.createdAt)} />
              <MetaRow icon={CalendarClock} label="Updated" value={formatRelativeTime(simulation.updatedAt)} />
              <MetaRow icon={Hash} label="ID" value={simulation.id} mono />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: SimulationParticipantView }) {
  const entity = participant.entity;
  const category = resolveCategory(entity?.category ?? "");
  const CategoryIcon = category.icon;
  const accent = entity?.primaryColor ?? undefined;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-hover text-xs font-medium text-muted">
        {participant.position + 1}
      </span>
      <span
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background/60 text-accent"
        style={accent ? { borderColor: `${accent}66`, color: accent } : undefined}
      >
        {entity?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entity.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <CategoryIcon className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        {entity ? (
          <Link
            href={`/entities/${entity.id}`}
            className="block truncate text-sm font-medium text-foreground transition-colors hover:text-accent"
          >
            {entity.name}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium italic text-muted">Entity unavailable</p>
        )}
        <p className="truncate text-xs text-muted">
          {category.label}
          {participant.role ? ` · ${participant.role}` : ""}
        </p>
      </div>
    </li>
  );
}

function SettingGrid({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-muted">{row.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-secondary">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={`truncate text-secondary${mono ? " font-mono text-xs" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
