import Link from "next/link";
import { Clapperboard, Clock3, Layers3 } from "lucide-react";
import { MEDIA_ASPECT_RATIO_LABELS, type MediaArtifactStatus, type MediaAspectRatio } from "@/lib/media/constants";
import { formatRelativeTime } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function statusVariant(status: MediaArtifactStatus): BadgeVariant {
  if (status === "READY") return "success";
  if (status === "ARCHIVED") return "neutral";
  return "warning";
}

export function MediaArtifactCard({ artifact }: { artifact: {
  id: string;
  status: MediaArtifactStatus;
  currentVersion: number;
  updatedAt: Date;
  source: { simulationName: string; mode: string };
  version: { title: string; subtitle: string | null; aspectRatio: MediaAspectRatio; storyboard: { scenes: { enabled: boolean }[] } };
} }) {
  const enabledScenes = artifact.version.storyboard.scenes.filter((scene) => scene.enabled).length;
  return (
    <Link href={`/studio/${artifact.id}`} className="block min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card interactive as="article" className="h-full min-w-0 overflow-hidden">
        <div className="relative grid min-h-36 place-items-center overflow-hidden border-b border-border bg-gradient-to-br from-accent-soft via-surface to-purple/10">
          <div className="absolute inset-0 grid-overlay opacity-30" aria-hidden />
          <span className="relative grid size-14 place-items-center rounded-2xl border border-accent/25 bg-background/60 text-accent shadow-lg">
            <Clapperboard className="size-7" aria-hidden />
          </span>
          <Badge variant={statusVariant(artifact.status)} className="absolute left-3 top-3">{artifact.status}</Badge>
          <Badge variant="outline" className="absolute right-3 top-3">{MEDIA_ASPECT_RATIO_LABELS[artifact.version.aspectRatio]}</Badge>
        </div>
        <div className="min-w-0 p-5">
          <h2 className="truncate font-display text-lg font-semibold text-foreground">{artifact.version.title}</h2>
          <p className="mt-1 truncate text-sm text-secondary">{artifact.version.subtitle ?? artifact.source.simulationName}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            <span className="capitalize">{artifact.source.mode}</span>
            <span className="inline-flex items-center gap-1"><Layers3 className="size-3.5" />{enabledScenes} scenes · v{artifact.currentVersion}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{formatRelativeTime(artifact.updatedAt)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
