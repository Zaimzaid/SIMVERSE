"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { MEDIA_ASPECT_RATIO_LABELS, MEDIA_ASPECT_RATIOS, type MediaAspectRatio } from "@/lib/media/constants";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface SourceOption {
  runId: string;
  simulationName: string;
  mode: string;
  participantNames: string[];
  artifactCount: number;
}

interface CreationResponse { artifact: { id: string } }

export function StudioCreatePanel({ sources }: { sources: SourceOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [runId, setRunId] = useState(sources[0]?.runId ?? "");
  const [aspectRatio, setAspectRatio] = useState<MediaAspectRatio>("LANDSCAPE_16_9");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!runId || busy) return;
    setBusy(true);
    const result = await apiFetch<CreationResponse>("/api/media/artifacts/from-run", {
      method: "POST",
      body: JSON.stringify({ runId, aspectRatio }),
    });
    if (result.error || !result.data?.artifact) {
      setBusy(false);
      toast({ variant: "error", title: "Storyboard could not be created", description: result.error?.message });
      return;
    }
    toast({ variant: "success", title: "Storyboard created", description: "Your first immutable version is ready to edit." });
    router.push(`/studio/${result.data.artifact.id}`);
  }

  if (sources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/30 p-5">
        <p className="font-medium text-foreground">Finish a Battle, Race, or Survival Run first.</p>
        <p className="mt-1 text-sm text-secondary">Completed supported Runs will appear here without changing their saved outcome.</p>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.35fr)_auto] lg:items-end">
      <label className="min-w-0 space-y-1.5 text-sm font-medium text-foreground">
        Completed Run
        <Select value={runId} onChange={(event) => setRunId(event.target.value)}>
          {sources.map((source) => (
            <option key={source.runId} value={source.runId}>
              {source.simulationName} · {source.mode} · {source.participantNames.slice(0, 3).join(" vs ")}
              {source.artifactCount ? ` · ${source.artifactCount} created` : ""}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1.5 text-sm font-medium text-foreground">
        Format
        <Select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as MediaAspectRatio)}>
          {MEDIA_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{MEDIA_ASPECT_RATIO_LABELS[ratio]}</option>)}
        </Select>
      </label>
      <Button size="lg" onClick={() => void create()} loading={busy} disabled={!runId}>
        {busy ? null : <Sparkles className="size-4" aria-hidden />}
        Create storyboard
      </Button>
      <p className="flex items-center gap-2 text-xs text-muted lg:col-span-3">
        <Clapperboard className="size-3.5" aria-hidden />
        Each creation starts a separate artifact. The source Run remains unchanged.
      </p>
    </div>
  );
}
