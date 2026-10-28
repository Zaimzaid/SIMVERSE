import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, FileVideo, Layers3, Sparkles, WandSparkles } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listCompletedMediaSources, listMediaArtifacts } from "@/server/services/media-artifact-service";
import { MediaArtifactCard } from "@/components/media/media-artifact-card";
import { StudioCreatePanel } from "@/components/media/studio-create-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Studio" };

export default async function StudioPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canCreate = permissions.includes("media.create");
  const [library, drafts, ready, sources] = await Promise.all([
    listMediaArtifacts(user.id, workspace.id, { status: "CURRENT", pageSize: 24 }),
    listMediaArtifacts(user.id, workspace.id, { status: "DRAFT", pageSize: 1 }),
    listMediaArtifacts(user.id, workspace.id, { status: "READY", pageSize: 1 }),
    canCreate ? listCompletedMediaSources(user.id, workspace.id, 16) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Clapperboard}
        eyebrow="Creator / Media"
        title="SIMVERSE Studio"
        description="Turn completed simulations into editable, versioned stories without changing what happened."
      />

      <Link href="/animation" className="flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft/50 p-5 hover:border-accent">
        <div><h2 className="flex items-center gap-2 font-semibold"><WandSparkles className="size-5 text-accent"/> Open Animation Studio</h2>
        <p className="mt-1 text-sm text-secondary">Build standalone 2D keyframe scenes; no completed simulation required.</p></div>
        <span className="text-sm font-semibold text-accent">Open →</span>
      </Link>

      {canCreate ? (
        <Card as="section" className="overflow-hidden border-accent/25 bg-gradient-to-br from-accent-soft via-surface to-purple/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="size-5 text-accent" />Create from a completed Run</CardTitle>
            <p className="max-w-3xl text-sm text-secondary">SIMVERSE selects a bounded set of saved highlights, preserves the authoritative result, and opens a draft storyboard you can shape.</p>
          </CardHeader>
          <CardContent><StudioCreatePanel sources={sources} /></CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="recent-content-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-content-heading" className="font-display text-xl font-semibold text-foreground">Recent Content</h2>
            <p className="mt-1 text-sm text-secondary">{library.total} workspace {library.total === 1 ? "storyboard" : "storyboards"} · {drafts.total} drafts · {ready.total} ready</p>
          </div>
          <p className="inline-flex items-center gap-2 text-xs text-muted"><Layers3 className="size-4" />Most recently updated first</p>
        </div>
        {library.items.length ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {library.items.map((artifact) => <MediaArtifactCard key={artifact.id} artifact={artifact} />)}
          </div>
        ) : (
          <EmptyState
            icon={Clapperboard}
            title="Your stories will appear here"
            description="Finish a supported simulation, then turn its result into content. Battle, Race, and Survival are ready for storyboards."
          />
        )}
      </section>

      <Card as="section" className="border-dashed">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background/40 text-muted"><FileVideo className="size-5" /></span>
          <div>
            <h2 className="font-medium text-foreground">A foundation for future media tools</h2>
            <p className="mt-1 text-sm text-secondary">Video editing, rendered exports, publishing, and AI direction come later. This Studio currently creates truthful structured storyboards and browser result card previews.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
