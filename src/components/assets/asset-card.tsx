import Link from "next/link";
import { Box, FileAudio, Image as ImageIcon, Package, Sparkles } from "lucide-react";
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, type AssetStatus, type AssetType } from "@/lib/assets/constants";
import type { AssetView } from "@/server/services/asset-service";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function iconFor(type: AssetType) {
  if (["MODEL_3D", "RIG", "PROP", "CHARACTER", "CREATURE", "VEHICLE", "ENVIRONMENT"].includes(type)) return Box;
  if (type === "AUDIO") return FileAudio;
  if (["CONCEPT_ART", "TEXTURE", "MATERIAL"].includes(type)) return ImageIcon;
  if (["ANIMATION", "VFX"].includes(type)) return Sparkles;
  return Package;
}

export function assetStatusVariant(status: AssetStatus): BadgeVariant {
  if (status === "RUNTIME_READY") return "success";
  if (status === "VALIDATED" || status === "CONCEPT_APPROVED") return "accent";
  if (status === "REVIEW" || status === "IN_PRODUCTION") return "warning";
  if (status === "ARCHIVED") return "neutral";
  return "outline";
}

export function AssetCard({ asset, view = "gallery" }: { asset: AssetView; view?: "gallery" | "list" }) {
  const Icon = iconFor(asset.type);
  if (view === "list") {
    return (
      <Link href={`/assets/${asset.id}`} className="block">
        <Card interactive className="flex items-center gap-4 p-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{asset.name}</p>
            <p className="truncate text-sm text-muted">{ASSET_TYPE_LABELS[asset.type]} · Version {asset.currentVersion}</p>
          </div>
          <div className="hidden flex-wrap gap-1 md:flex">{asset.tags.slice(0, 3).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
          <Badge variant={assetStatusVariant(asset.status)}>{ASSET_STATUS_LABELS[asset.status]}</Badge>
          <time className="hidden w-24 text-right text-xs text-muted sm:block">{asset.updatedAt.toLocaleDateString()}</time>
        </Card>
      </Link>
    );
  }
  return (
    <Link href={`/assets/${asset.id}`} className="block h-full">
      <Card interactive className="flex h-full flex-col overflow-hidden">
        <div className="relative flex aspect-[16/9] items-center justify-center border-b border-border bg-gradient-to-br from-accent-soft to-surface-elevated">
          {asset.version.thumbnailReference ? (
            // Safe metadata references may point to an external storage provider; keep the browser request uncredentialed.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.version.thumbnailReference} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : <Icon className="size-12 text-accent/70" />}
          <Badge variant={assetStatusVariant(asset.status)} className="absolute right-3 top-3">{ASSET_STATUS_LABELS[asset.status]}</Badge>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div><p className="font-semibold text-foreground">{asset.name}</p><p className="text-sm text-muted">{ASSET_TYPE_LABELS[asset.type]} · v{asset.currentVersion}</p></div>
          {asset.description ? <p className="line-clamp-2 text-sm text-secondary">{asset.description}</p> : null}
          <div className="mt-auto flex flex-wrap gap-1">{asset.tags.slice(0, 4).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
          <p className="text-xs text-muted">{asset.entities.length} Entity association{asset.entities.length === 1 ? "" : "s"} · Updated {asset.updatedAt.toLocaleDateString()}</p>
        </div>
      </Card>
    </Link>
  );
}
