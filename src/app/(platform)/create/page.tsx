import type { Metadata } from "next";
import { Boxes, FolderKanban, Globe2, Sparkles, Swords } from "lucide-react";
import {
  canOpenCreateDestination,
  createDestinationById,
  type CreateDestinationId,
} from "@/lib/create/catalog";
import { requirePlatformContext } from "@/server/context";
import { CreationCard } from "@/components/create/creation-card";
import {
  AnimationCreationPreview,
  AnythingWarsCreationPreview,
  EntityCreationPreview,
  ProjectCreationPreview,
  SimulationCreationPreview,
  WorldCreationPreview,
} from "@/components/create/creation-previews";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Create" };

function previewFor(id: CreateDestinationId) {
  switch (id) {
    case "anything-wars": return <AnythingWarsCreationPreview />;
    case "entity": return <EntityCreationPreview />;
    case "world": return <WorldCreationPreview />;
    case "simulation": return <SimulationCreationPreview />;
    case "project": return <ProjectCreationPreview />;
    case "animation": return <AnimationCreationPreview />;
  }
}

export default async function CreatePage() {
  const { permissions } = await requirePlatformContext();
  const render = (id: CreateDestinationId, featured = false) => {
    const destination = createDestinationById(id);
    return (
      <CreationCard
        key={id}
        destination={destination}
        preview={previewFor(id)}
        available={canOpenCreateDestination(destination, permissions)}
        featured={featured}
      />
    );
  };

  return (
    <div className="space-y-10">
      <div className="simverse-page-scene simverse-page-scene--create">
        <PageHeader
          eyebrow="Create in SIMVERSE"
          title="Build your SIMVERSE"
          description="Choose what to create. Launch a simulation, design an entity, assemble a world or organize a project. Your tools are grouped by what you want to make."
          icon={Sparkles}
        />
      </div>

      <section aria-labelledby="quick-start-heading">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="size-4 text-accent" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Recommended first step</p>
            <h2 id="quick-start-heading" className="text-lg font-semibold text-foreground">Create your first result in minutes</h2>
          </div>
        </div>
        {render("anything-wars", true)}
      </section>

      <section aria-labelledby="building-blocks-heading">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="size-4 text-accent" />
          <div>
            <h2 id="building-blocks-heading" className="text-lg font-semibold text-foreground">Build the pieces of your universe</h2>
            <p className="text-sm text-muted">Reusable creations can appear across projects and experiences.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {render("entity")}
          {render("world")}
          {render("simulation")}
        </div>
      </section>

      <section aria-labelledby="organize-and-future-heading">
        <div className="mb-4 flex items-center gap-2">
          <FolderKanban className="size-4 text-accent" />
          <h2 id="organize-and-future-heading" className="text-lg font-semibold text-foreground">Organize today, see what is next</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {render("project")}
          {render("animation")}
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-secondary">
        <Globe2 className="mt-0.5 size-4 shrink-0 text-accent" />
        <p><strong className="text-foreground">Simple first, powerful later.</strong> Each creator starts with the choices needed to succeed. Detailed controls remain available when you want them.</p>
      </aside>
    </div>
  );
}
