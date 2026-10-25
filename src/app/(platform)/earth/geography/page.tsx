import type { Metadata } from "next";
import { Map } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GeographyExplorer } from "@/components/earth/geography-explorer";
import { requirePlatformContext } from "@/server/context";
import {
  getEarthGeographyCatalogStatus,
  listEarthCountries,
} from "@/server/services/earth-geography-service";

export const metadata: Metadata = { title: "Earth Geography Lab" };

export default async function EarthGeographyPage() {
  const { user, workspace } = await requirePlatformContext();
  const [countries, status] = await Promise.all([
    listEarthCountries(user.id, workspace.id, { limit: 25 }),
    getEarthGeographyCatalogStatus(user.id, workspace.id),
  ]);
  const datasetLabels = status.datasets.flatMap((dataset) => dataset.versions
    .filter((version) => version.status === "ACTIVE")
    .map((version) => `${dataset.provider} ${version.version}`));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Map}
        title="Earth Geography Lab"
        description="Internal Phase 2 proof for sourced country, state and point-only locality navigation. Land acquisition and construction are not available."
      />
      <GeographyExplorer
        initialCountries={countries.items}
        initialPlaceCount={status.placeCount}
        datasetLabels={datasetLabels}
      />
    </div>
  );
}
