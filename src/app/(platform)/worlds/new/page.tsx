import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Globe2 } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listAssets } from "@/server/services/asset-service"; import { listEntities } from "@/server/services/entity-service";
import { PageHeader } from "@/components/ui/page-header"; import { EmptyState } from "@/components/ui/empty-state"; import { buttonClasses } from "@/components/ui/button"; import { WorldForm } from "@/components/worlds/world-form";
export const metadata: Metadata = { title: "New World" };
export default async function NewWorldPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  if (!permissions.includes("world.manage")) return <div className="space-y-6"><PageHeader icon={Globe2} title="New World" description="Create an environment blueprint." /><EmptyState icon={Globe2} title="You can’t create Worlds" description="Your role does not include World management." action={<Link href="/worlds" className={buttonClasses({ variant: "secondary" })}>Back to Worlds</Link>} /></div>;
  const [assets, entities] = await Promise.all([listAssets(user.id, workspace.id, { status: "CURRENT", pageSize: 100, sort: "name_asc" }), listEntities(user.id, workspace.id, { status: "ACTIVE", pageSize: 100, sort: "name_asc" })]);
  return <div className="space-y-6"><div><Link href="/worlds" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Worlds</Link><PageHeader icon={Globe2} title="New World" description="Define environment metadata, reusable content bindings, zones, spawn sets, and presentation hints." /></div>
    <WorldForm mode="create" assets={assets.items.map((asset) => ({ id: asset.id, name: asset.name, detail: `${asset.type} · v${asset.currentVersion}`, currentVersion: asset.currentVersion, type: asset.type }))} entities={entities.items.map((entity) => ({ id: entity.id, name: entity.name, detail: entity.category }))} />
  </div>;
}
