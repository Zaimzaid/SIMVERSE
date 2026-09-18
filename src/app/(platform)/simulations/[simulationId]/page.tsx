import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  FolderKanban,
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
import { NotFoundError } from "@/lib/errors";
import { resolveCategory } from "@/lib/entities/categories";
import { resolveMode } from "@/lib/simulations/modes";
import { SIMULATION_STATUS_META } from "@/lib/simulations/constants";
import {
  BATTLE_FORMAT_LABELS,
  RACE_STYLE_LABELS,
  SIMULATION_DIFFICULTY_META,
  SIMULATION_SPEED_LABELS,
  SURVIVAL_SCENARIO_LABELS,
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
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationActions } from "@/components/simulations/simulation-actions";

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
    if (error instanceof NotFoundError) notFound();
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
function generalSettingRows(config: SimulationConfigV1): { label: string; value: string }[] {
  const g = config.general;
  return [
    { label: "Speed", value: SIMULATION_SPEED_LABELS[g.speed] ?? g.speed },
    { label: "Difficulty", value: SIMULATION_DIFFICULTY_META[g.difficulty]?.label ?? g.difficulty },
    { label: "Round limit", value: g.roundLimit == null ? "No limit" : g.roundLimit.toLocaleString() },
    { label: "Random events", value: g.randomEvents ? "Enabled" : "Disabled" },
    { label: "Ties", value: g.allowTies ? "Allowed" : "Not allowed" },
  ];
}

/**
 * Human-readable rows for the mode-specific placeholder settings. These are
 * stored preferences only — they carry no mechanics (execution is Phase 3).
 */
function modeSettingRows(mode: string, config: Record<string, unknown>): { label: string; value: string }[] {
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  switch (mode) {
    case "battle": {
      const v = str(config.format);
      return v ? [{ label: "Format", value: BATTLE_FORMAT_LABELS[v as keyof typeof BATTLE_FORMAT_LABELS] ?? v }] : [];
    }
    case "race": {
      const v = str(config.raceStyle);
      return v ? [{ label: "Race style", value: RACE_STYLE_LABELS[v as keyof typeof RACE_STYLE_LABELS] ?? v }] : [];
    }
    case "tournament": {
      const v = str(config.format);
      return v
        ? [{ label: "Format", value: TOURNAMENT_FORMAT_LABELS[v as keyof typeof TOURNAMENT_FORMAT_LABELS] ?? v }]
        : [];
    }
    case "survival": {
      const v = str(config.scenarioType);
      return v
        ? [{ label: "Scenario", value: SURVIVAL_SCENARIO_LABELS[v as keyof typeof SURVIVAL_SCENARIO_LABELS] ?? v }]
        : [];
    }
    default:
      return [];
  }
}

export default async function SimulationDetailPage({ params }: PageParams) {
  const { simulationId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const simulation = await loadSimulation(user.id, workspace.id, simulationId);

  const mode = resolveMode(simulation.mode);
  const ModeIcon = mode.icon;
  const statusMeta = SIMULATION_STATUS_META[simulation.status];
  const isArchived = simulation.status === "ARCHIVED";
  const isReady = simulation.status === "READY";
  const canEdit = permissions.includes("simulation.edit");

  const generalRows = generalSettingRows(simulation.configuration);
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

      {/* Execution boundary notice — a simulation is configuration only; it cannot be run yet. */}
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4">
        <Rocket className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-foreground">
            {isReady ? "This blueprint is ready to run — later." : "This is a configuration, not a run."}
          </p>
          <p className="mt-0.5 text-secondary">
            {isReady
              ? "“Ready” means the configuration is complete. The execution engine that actually runs simulations arrives in Phase 3 — there is nothing to run yet."
              : "Set up the mode, participants and rules, then save. Running simulations arrives with the execution engine in Phase 3."}
          </p>
        </div>
      </div>

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
