"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, Gauge, Settings2, Sparkles, Swords } from "lucide-react";
import {
  anythingWarsExecutionIssue,
  anythingWarsParticipantLimit,
  type AnythingWarsEventMode,
} from "@/lib/anything-wars/constants";
import { quickWarConfiguration } from "@/lib/anything-wars/quick";
import { anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { apiFetch } from "@/lib/client/api";
import type { ParticipantChoice } from "@/components/simulations/simulation-builder-model";
import { EntityPicker } from "@/components/simulations/entity-picker";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const QUICK_MODES = [
  { id: "battle", label: "Battle", description: "Compete directly until one remains or time runs out.", icon: Swords },
  { id: "race", label: "Race", description: "Compete across a course using speed and acceleration.", icon: Gauge },
  { id: "survival", label: "Survival", description: "Endure resources, hazards, and changing conditions.", icon: Flame },
] as const;

interface QuickWarResponse {
  simulation: { id: string };
  run: { id: string; status: string };
}

export function QuickWarForm({ initialMode }: { initialMode: AnythingWarsEventMode }) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<AnythingWarsEventMode>(initialMode);
  const [participants, setParticipants] = useState<ParticipantChoice[]>([]);
  const [starting, setStarting] = useState(false);

  const issue = useMemo(() => {
    const configuration = quickWarConfiguration(mode, participants.length);
    return anythingWarsExecutionIssue(mode, configuration.mode, participants.length);
  }, [mode, participants.length]);

  async function start() {
    if (issue) {
      toast({ variant: "error", title: "Choose competitors first", description: issue });
      return;
    }
    setStarting(true);
    const result = await apiFetch<QuickWarResponse>("/api/anything-wars/quick", {
      method: "POST",
      body: JSON.stringify({ mode, participantIds: participants.map((participant) => participant.entityId) }),
    });
    setStarting(false);
    if (result.error || !result.data) {
      toast({ variant: "error", title: "Could not start this war", description: result.error?.message ?? "Try again." });
      return;
    }
    toast({ variant: "success", title: "War started", description: "Your competitors and result history are safely saved." });
    router.push(anythingWarsRunHref(result.data.simulation.id, result.data.run.id));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <Card as="section" className="overflow-hidden border-accent/20">
        <CardHeader className="border-b border-border bg-gradient-to-r from-accent-soft to-transparent">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">1 · Choose what happens</span>
          <CardTitle className="text-xl">Pick a competition</CardTitle>
          <CardDescription>These are the modes that work today. You can change every detail later in Custom War.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-3" role="radiogroup" aria-label="Competition type">
          {QUICK_MODES.map((option) => {
            const selected = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(option.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-accent/55 bg-accent-soft" : "border-border bg-background/40 hover:border-accent/30 hover:bg-surface-hover",
                )}
              >
                <span className={cn("grid size-10 place-items-center rounded-lg", selected ? "bg-accent text-accent-foreground" : "bg-surface-elevated text-accent")}><option.icon className="size-5" /></span>
                <span className="mt-3 block font-semibold text-foreground">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-secondary">{option.description}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card as="section">
        <CardHeader>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">2 · Choose who competes</span>
          <CardTitle className="text-xl">Pick at least two competitors</CardTitle>
          <CardDescription>Use any active character, animal, robot, vehicle, country, team, or object in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityPicker
            projectId={null}
            scope="workspace"
            value={participants}
            onChange={setParticipants}
            minEntities={2}
            maxEntities={anythingWarsParticipantLimit(mode)}
            language="competitors"
            createHref="/entities/new?returnTo=%2Fanything-wars%2Fquick"
            showAttributes
          />
        </CardContent>
      </Card>

      <Card as="section" className="border-accent/25 bg-gradient-to-br from-surface to-accent-soft">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-accent"><Sparkles className="size-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Ready when you are</span></div>
            <p className="mt-2 text-lg font-semibold text-foreground">{participants.length >= 2 ? `${participants.length} competitors · ${QUICK_MODES.find((item) => item.id === mode)?.label}` : "Choose two competitors to start"}</p>
            <p className="mt-1 max-w-xl text-sm text-secondary">SIMVERSE will use balanced working rules, organize the event, choose a fresh seed, and save the real result automatically.</p>
            {issue && participants.length > 0 ? <p className="mt-2 text-xs font-medium text-warning">{issue}</p> : null}
          </div>
          <Button size="lg" onClick={() => void start()} loading={starting} disabled={Boolean(issue)} className="w-full sm:w-auto">
            <Swords className="size-4" />Start {QUICK_MODES.find((item) => item.id === mode)?.label}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div><p className="text-sm font-medium text-foreground">Want control over the arena, presentation, seed, and every rule?</p><p className="mt-0.5 text-xs text-muted">The complete creator remains available.</p></div>
        <Link href={`/anything-wars/create?mode=${mode}`} className={buttonClasses({ variant: "secondary" })}><Settings2 className="size-4" />Open Custom War</Link>
      </div>
    </div>
  );
}
