"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Film,
  History,
  LockKeyhole,
  Save,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import {
  MEDIA_ASPECT_RATIO_LABELS,
  MEDIA_ASPECT_RATIOS,
  type MediaArtifactStatus,
  type MediaAspectRatio,
} from "@/lib/media/constants";
import type { StoryboardSceneV1, StoryboardV1 } from "@/lib/media/schemas";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ExportPanel } from "./export-panel";

interface EditorArtifact {
  id: string;
  type: "STORYBOARD";
  status: MediaArtifactStatus;
  currentVersion: number;
  source: {
    runId: string;
    simulationId: string;
    simulationName: string;
    mode: string;
    moduleId: string;
    moduleVersion: string;
  };
  version: {
    title: string;
    subtitle: string | null;
    description: string | null;
    aspectRatio: MediaAspectRatio;
    storyboard: StoryboardV1;
  };
  versions: {
    id: string;
    version: number;
    status: MediaArtifactStatus;
    createdByName: string | null;
    createdAt: string;
  }[];
}

interface ArtifactResponse { artifact: { id: string; currentVersion: number } }

const sceneTone: Record<StoryboardSceneV1["kind"], string> = {
  INTRO: "border-accent/35 bg-accent-soft",
  COMPETITOR: "border-blue/35 bg-blue/10",
  HIGHLIGHT: "border-border-strong bg-surface-elevated",
  TURNING_POINT: "border-warning/35 bg-warning-soft",
  RESULT: "border-success/35 bg-success-soft",
  OUTRO: "border-purple/35 bg-purple/10",
};

export function StoryboardEditor({ artifact, canEdit }: { artifact: EditorArtifact; canEdit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(artifact.version.title);
  const [subtitle, setSubtitle] = useState(artifact.version.subtitle ?? "");
  const [description, setDescription] = useState(artifact.version.description ?? "");
  const [aspectRatio, setAspectRatio] = useState(artifact.version.aspectRatio);
  const [status, setStatus] = useState<"DRAFT" | "READY">(artifact.status === "READY" ? "READY" : "DRAFT");
  const [scenes, setScenes] = useState(() => artifact.version.storyboard.scenes.map((scene) => ({ ...scene })));
  const [busy, setBusy] = useState(false);
  const participantNames = useMemo(
    () => new Map(artifact.version.storyboard.participants.map((participant) => [participant.runParticipantId, participant.name])),
    [artifact.version.storyboard.participants],
  );
  const archived = artifact.status === "ARCHIVED";

  function updateScene(id: string, patch: Partial<Pick<StoryboardSceneV1, "title" | "caption" | "enabled">>) {
    setScenes((current) => current.map((scene) => scene.id === id ? { ...scene, ...patch } : scene));
  }

  function moveScene(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= scenes.length) return;
    setScenes((current) => {
      const next = [...current];
      const selected = next[index];
      const other = next[destination];
      if (!selected || !other) return current;
      next[index] = other;
      next[destination] = selected;
      return next.map((scene, order) => ({ ...scene, order }));
    });
  }

  async function save() {
    if (!canEdit || archived || busy) return;
    setBusy(true);
    const result = await apiFetch<ArtifactResponse>(`/api/media/artifacts/${artifact.id}/versions`, {
      method: "POST",
      body: JSON.stringify({
        title,
        subtitle,
        description,
        aspectRatio,
        status,
        scenes: scenes.map(({ id, order, title: sceneTitle, caption, enabled }) => ({
          id, order, title: sceneTitle, caption, enabled,
        })),
      }),
    });
    setBusy(false);
    if (result.error) {
      toast({ variant: "error", title: "Version could not be saved", description: result.error.message });
      return;
    }
    toast({ variant: "success", title: `Version ${artifact.currentVersion + 1} saved`, description: "Earlier versions remain unchanged." });
    router.refresh();
  }

  async function changeArchiveState() {
    if (!canEdit || busy) return;
    setBusy(true);
    const action = archived ? "restore" : "archive";
    const result = await apiFetch<ArtifactResponse>(`/api/media/artifacts/${artifact.id}/${action}`, { method: "POST" });
    setBusy(false);
    if (result.error) {
      toast({ variant: "error", title: "Status could not be changed", description: result.error.message });
      return;
    }
    toast({ variant: "success", title: archived ? "Storyboard restored" : "Storyboard archived" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/studio" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />Back to Studio
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={artifact.status === "READY" ? "success" : artifact.status === "ARCHIVED" ? "neutral" : "warning"}>{artifact.status}</Badge>
          <Badge variant="outline">{artifact.type} · v{artifact.currentVersion}</Badge>
        </div>
      </div>

      {!canEdit ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-secondary">
          <LockKeyhole className="size-4 shrink-0 text-muted" aria-hidden />You have read-only access to this storyboard.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <main className="min-w-0 space-y-6">
          <Card as="section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-accent" />Creative direction</CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-foreground sm:col-span-2">Title
                <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit || archived} maxLength={160} />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground sm:col-span-2">Subtitle
                <Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} disabled={!canEdit || archived} maxLength={240} />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground sm:col-span-2">Description
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit || archived} maxLength={2000} rows={3} />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">Format
                <Select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as MediaAspectRatio)} disabled={!canEdit || archived}>
                  {MEDIA_ASPECT_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{MEDIA_ASPECT_RATIO_LABELS[ratio]}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">Production status
                <Select value={status} onChange={(event) => setStatus(event.target.value as "DRAFT" | "READY")} disabled={!canEdit || archived}>
                  <option value="DRAFT">Draft</option><option value="READY">Ready</option>
                </Select>
              </label>
            </CardContent>
          </Card>

          <ExportPanel
            artifactId={artifact.id}
            currentVersion={artifact.currentVersion}
            versions={artifact.versions.map((entry) => entry.version)}
            defaultAspectRatio={artifact.version.aspectRatio}
          />

          <section aria-labelledby="storyboard-heading" className="space-y-4">
            <div>
              <h2 id="storyboard-heading" className="font-display text-xl font-semibold text-foreground">Storyboard</h2>
              <p className="mt-1 text-sm text-secondary">Edit the presentation. Event references and participant identities stay locked to the source Run.</p>
            </div>
            <ol className="grid min-w-0 gap-4 lg:grid-cols-2">
              {scenes.map((scene, index) => (
                <li key={scene.id} className={cn("min-w-0 rounded-xl border p-4", sceneTone[scene.kind], !scene.enabled && "opacity-60")}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge><Badge variant={scene.kind === "RESULT" ? "success" : scene.kind === "TURNING_POINT" ? "warning" : "neutral"}>{scene.kind.replaceAll("_", " ")}</Badge>
                      </div>
                      {scene.sourceEventSequence ? <p className="mt-2 text-xs text-muted">Source event #{scene.sourceEventSequence}</p> : null}
                    </div>
                    {canEdit && !archived ? (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="icon" size="sm" aria-label="Move scene earlier" disabled={index === 0} onClick={() => moveScene(index, -1)}><ArrowUp className="size-4" /></Button>
                        <Button variant="icon" size="sm" aria-label="Move scene later" disabled={index === scenes.length - 1} onClick={() => moveScene(index, 1)}><ArrowDown className="size-4" /></Button>
                        <Button variant="icon" size="sm" aria-label={scene.enabled ? "Disable scene" : "Enable scene"} onClick={() => updateScene(scene.id, { enabled: !scene.enabled })}>
                          {scene.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="space-y-1 text-xs font-medium text-secondary">Scene title
                      <Input value={scene.title} onChange={(event) => updateScene(scene.id, { title: event.target.value })} disabled={!canEdit || archived} maxLength={160} />
                    </label>
                    <label className="space-y-1 text-xs font-medium text-secondary">Caption
                      <Textarea value={scene.caption} onChange={(event) => updateScene(scene.id, { caption: event.target.value })} disabled={!canEdit || archived} rows={3} maxLength={600} />
                    </label>
                  </div>
                  {scene.participantRefs.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {scene.participantRefs.slice(0, 6).map((id) => <span key={id} className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-xs text-muted">{participantNames.get(id) ?? "Participant"}</span>)}
                      {scene.participantRefs.length > 6 ? <span className="text-xs text-muted">+{scene.participantRefs.length - 6}</span> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          {canEdit ? (
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-strong bg-surface/95 p-4 shadow-xl backdrop-blur">
              <p className="text-sm text-secondary">Saving creates version {artifact.currentVersion + 1}. Version {artifact.currentVersion} remains immutable.</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void changeArchiveState()} loading={busy}>
                  {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}{archived ? "Restore" : "Archive"}
                </Button>
                {!archived ? <Button onClick={() => void save()} loading={busy}><Save className="size-4" />Save new version</Button> : null}
              </div>
            </div>
          ) : null}
        </main>

        <aside className="min-w-0 space-y-6">
          <Card as="section">
            <CardHeader><CardTitle className="flex items-center gap-2"><Film className="size-4 text-accent" />Source truth</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-xs text-muted">Simulation</p><p className="mt-1 break-words font-medium text-foreground">{artifact.source.simulationName}</p></div>
              <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted">Mode</p><p className="mt-1 capitalize text-foreground">{artifact.source.mode}</p></div><div><p className="text-xs text-muted">Module</p><p className="mt-1 break-all font-mono text-xs text-foreground">{artifact.source.moduleVersion}</p></div></div>
              <div><p className="text-xs text-muted">Completion</p><p className="mt-1 text-foreground">{artifact.version.storyboard.summary.completionReason.replaceAll("_", " ")}</p></div>
              <Link href={`/simulations/${artifact.source.simulationId}/runs/${artifact.source.runId}`} className={buttonClasses({ variant: "secondary", className: "w-full" })}>View source Run</Link>
            </CardContent>
          </Card>

          <Card as="section">
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4 text-accent" />Version history</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {artifact.versions.map((version) => (
                  <li key={version.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/30 p-3 text-sm">
                    <div><p className="flex items-center gap-1.5 font-medium text-foreground">Version {version.version}{version.version === artifact.currentVersion ? <Check className="size-3.5 text-success" aria-label="Current version" /> : null}</p><p className="mt-1 text-xs text-muted">{version.createdByName ?? "Former member"} · {formatRelativeTime(new Date(version.createdAt))}</p></div>
                    <Badge variant={version.status === "READY" ? "success" : "neutral"}>{version.status}</Badge>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
