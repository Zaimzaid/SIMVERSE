import {
  Bot,
  Box,
  Camera,
  Car,
  Clapperboard,
  Flag,
  Flame,
  FolderKanban,
  Gauge,
  Globe2,
  MapPin,
  PawPrint,
  Play,
  Sparkles,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";

function CreationPreview({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative min-h-44 overflow-hidden rounded-xl border border-border bg-background/70 p-4",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_18%_0%,var(--accent-soft),transparent_48%)]",
        className,
      )}
    >
      <div className="relative h-full" aria-hidden="true">{children}</div>
    </div>
  );
}

const ENTITY_EXAMPLES = [
  { label: "Lion", icon: PawPrint },
  { label: "Robot", icon: Bot },
  { label: "Car", icon: Car },
  { label: "Nigeria", icon: Flag },
] as const;

export function EntityCreationPreview() {
  return (
    <CreationPreview label="Example reusable creations: a lion, robot, car, and country">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {ENTITY_EXAMPLES.map((example, index) => (
          <div
            key={example.label}
            className="group/preview flex min-h-30 flex-col justify-between rounded-lg border border-border bg-surface/90 p-3 shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5"
          >
            <span className={cn(
              "grid size-9 place-items-center rounded-lg border bg-surface-elevated",
              index === 0 ? "border-warning/30 text-warning" : index === 1 ? "border-purple/30 text-purple" : "border-accent/30 text-accent",
            )}>
              <example.icon className="size-4.5" />
            </span>
            <span className="mt-5 text-xs font-semibold text-foreground">{example.label}</span>
          </div>
        ))}
      </div>
    </CreationPreview>
  );
}

export function WorldCreationPreview() {
  return (
    <CreationPreview label="A structured world blueprint with terrain, zones, and landmarks" className="min-h-52">
      <div className="absolute inset-x-0 top-0 h-24 rounded-t-lg bg-gradient-to-b from-blue/20 to-accent/5" />
      <div className="absolute inset-x-[-10%] bottom-[-22%] h-40 rounded-[50%] border border-accent/20 bg-gradient-to-b from-success/20 to-surface" />
      <div className="absolute bottom-11 left-[14%] h-9 w-7 rounded-t-sm border border-border-strong bg-surface-elevated" />
      <div className="absolute bottom-11 left-[24%] h-14 w-9 rounded-t-sm border border-border-strong bg-surface-elevated" />
      <div className="absolute bottom-12 right-[18%] grid size-9 place-items-center rounded-full border border-success/30 bg-success-soft text-success">
        <Globe2 className="size-4" />
      </div>
      <div className="absolute left-[54%] top-11 flex -translate-x-1/2 flex-col items-center text-accent">
        <MapPin className="size-7 drop-shadow-[0_0_10px_var(--accent)]" />
        <span className="mt-1 rounded-full border border-accent/25 bg-surface/90 px-2 py-0.5 text-[10px] font-medium">Arena zone</span>
      </div>
      <div className="absolute bottom-2 left-2 flex gap-1.5 text-[10px] text-secondary">
        <span className="rounded-full border border-border bg-surface/90 px-2 py-1">Terrain</span>
        <span className="rounded-full border border-border bg-surface/90 px-2 py-1">Spawns</span>
        <span className="rounded-full border border-border bg-surface/90 px-2 py-1">Climate</span>
      </div>
    </CreationPreview>
  );
}

function CompetitorToken({ label, icon: Icon, tone }: { label: string; icon: typeof PawPrint; tone: "accent" | "purple" }) {
  return (
    <div className={cn(
      "flex min-w-24 flex-col items-center rounded-xl border bg-surface/90 p-3",
      tone === "accent" ? "border-accent/35" : "border-purple/35",
    )}>
      <span className={cn("grid size-11 place-items-center rounded-full", tone === "accent" ? "bg-accent-soft text-accent" : "bg-purple/15 text-purple")}>
        <Icon className="size-5" />
      </span>
      <span className="mt-2 text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}

export function SimulationCreationPreview() {
  return (
    <CreationPreview label="A lion and robot enter a scenario and produce a calculated result" className="min-h-52">
      <div className="flex items-center justify-center gap-3 pt-2 sm:gap-5">
        <CompetitorToken label="Lion" icon={PawPrint} tone="accent" />
        <span className="font-display text-sm font-bold tracking-[0.2em] text-muted">VS</span>
        <CompetitorToken label="Robot" icon={Bot} tone="purple" />
      </div>
      <div className="mx-auto mt-4 flex max-w-xs items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-3 py-2 text-xs text-success">
        <Play className="size-3.5" />
        <span className="font-medium">Rules calculate the outcome</span>
        <Sparkles className="ml-auto size-3.5" />
      </div>
    </CreationPreview>
  );
}

export function AnythingWarsCreationPreview() {
  const modes = [
    { label: "Battle", icon: Swords },
    { label: "Race", icon: Gauge },
    { label: "Survival", icon: Flame },
  ] as const;
  return (
    <CreationPreview label="Anything Wars competition preview with Battle, Race, and Survival" className="min-h-60 sm:min-h-64">
      <div className="absolute inset-x-3 top-3 flex items-center justify-center gap-3 sm:gap-7">
        <CompetitorToken label="Anything" icon={Box} tone="accent" />
        <div className="grid size-12 place-items-center rounded-full border border-accent/30 bg-accent-soft font-display text-xs font-bold text-accent shadow-[0_0_24px_-8px_var(--accent)]">VS</div>
        <CompetitorToken label="Anything" icon={Bot} tone="purple" />
      </div>
      <div className="absolute inset-x-3 bottom-4 grid grid-cols-3 gap-2">
        {modes.map((mode) => (
          <div key={mode.label} className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/90 px-2 py-2 text-[11px] font-medium text-secondary">
            <mode.icon className="size-3.5 shrink-0 text-accent" />
            <span className="truncate">{mode.label}</span>
          </div>
        ))}
      </div>
    </CreationPreview>
  );
}

export function ProjectCreationPreview() {
  return (
    <CreationPreview label="A project folder organizing characters, worlds, and simulations">
      <div className="absolute left-1/2 top-1/2 w-[82%] max-w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-warning/25 bg-warning-soft p-4">
        <div className="flex items-center gap-2 text-warning">
          <FolderKanban className="size-5" />
          <span className="text-xs font-semibold text-foreground">My next idea</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[{ icon: PawPrint, label: "Things" }, { icon: Globe2, label: "Worlds" }, { icon: Swords, label: "Events" }].map((item) => (
            <div key={item.label} className="rounded-md border border-border bg-surface/90 p-2 text-center">
              <item.icon className="mx-auto size-3.5 text-accent" />
              <span className="mt-1 block text-[9px] text-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </CreationPreview>
  );
}

export function AnimationCreationPreview() {
  return (
    <CreationPreview label="Future Animation Studio scene, camera, and keyframe timeline" className="min-h-52 opacity-80">
      <div className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border bg-surface/90 p-3">
        <div className="relative grid min-h-24 place-items-center overflow-hidden rounded-md border border-border bg-background">
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-purple/20 to-transparent" />
          <Clapperboard className="size-9 text-purple" />
          <span className="absolute left-2 top-2 flex items-center gap-1 text-[9px] text-muted"><Camera className="size-3" /> Camera 01</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="grid size-8 place-items-center rounded-md border border-border bg-background text-accent"><PawPrint className="size-3.5" /></span>
          <span className="grid size-8 place-items-center rounded-md border border-border bg-background text-purple"><Sparkles className="size-3.5" /></span>
        </div>
      </div>
      <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-surface/90 p-2.5">
        {["Character", "Camera", "Audio"].map((track, index) => (
          <div key={track} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[9px] text-muted">
            <span>{track}</span>
            <span className="relative h-2 rounded-full bg-background">
              <span className={cn("absolute inset-y-0 rounded-full", index === 0 ? "left-[8%] right-[28%] bg-accent/45" : index === 1 ? "left-[24%] right-[8%] bg-purple/40" : "left-[4%] right-[45%] bg-warning/35")} />
            </span>
          </div>
        ))}
      </div>
    </CreationPreview>
  );
}
