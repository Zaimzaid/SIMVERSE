import Link from "next/link";
import { Hash, Users } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/utils";
import { resolveMode } from "@/lib/simulations/modes";
import { SIMULATION_STATUS_META } from "@/lib/simulations/constants";
import type { SimulationSummary } from "@/server/services/simulation-service";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SimulationActions } from "./simulation-actions";

export interface SimulationCardProps {
  simulation: SimulationSummary;
  permissions: Permission[];
  /** Hide the project chip when the card is already shown within a project. */
  hideProject?: boolean;
}

/**
 * A single simulation blueprint in a library grid. The whole card links to the
 * detail view. There is deliberately no "run" affordance — a simulation is a
 * configuration only; execution availability is separate from the blueprint.
 */
export function SimulationCard({ simulation, permissions, hideProject = false }: SimulationCardProps) {
  const mode = resolveMode(simulation.mode);
  const ModeIcon = mode.icon;
  const statusMeta = SIMULATION_STATUS_META[simulation.status];

  return (
    <Card interactive as="article" className="relative flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border-strong bg-background/60 text-accent">
          <ModeIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
            <Badge variant="outline">{simulation.modeLabel}</Badge>
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-foreground">
            <Link
              href={`/simulations/${simulation.id}`}
              className="after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-none"
            >
              {simulation.name}
            </Link>
          </h3>
          {!hideProject ? (
            <p className="mt-0.5 truncate text-xs text-muted">{simulation.projectName}</p>
          ) : null}
        </div>

        {/* Sits above the stretched link so the menu stays clickable. */}
        <div className="relative z-10 -mr-1 -mt-1">
          <SimulationActions
            simulation={{ id: simulation.id, name: simulation.name, status: simulation.status }}
            permissions={permissions}
          />
        </div>
      </div>

      {simulation.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-secondary">{simulation.description}</p>
      ) : (
        <p className="mt-3 line-clamp-2 text-sm italic text-muted">No description.</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {simulation.participantCount} {simulation.participantCount === 1 ? "entity" : "entities"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono" title="Simulation seed">
            <Hash className="size-3.5" />
            {simulation.seed}
          </span>
        </div>
        <span>Updated {formatRelativeTime(simulation.updatedAt)}</span>
      </div>
    </Card>
  );
}
