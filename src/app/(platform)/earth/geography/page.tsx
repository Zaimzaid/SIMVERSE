import type { Metadata } from "next";
import { Map } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GeographyExplorer } from "@/components/earth/geography-explorer";
import { earthPlaceIdSchema } from "@/lib/earth/schemas";
import { requirePlatformContext } from "@/server/context";
import {
  getEarthGeographyCatalogStatus,
  getEarthPlace,
  listEarthCountries,
} from "@/server/services/earth-geography-service";

export const metadata: Metadata = { title: "Earth Geography Lab" };

export default async function EarthGeographyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { user, workspace } = await requirePlatformContext();
  const [countries, status] = await Promise.all([
    listEarthCountries(user.id, workspace.id, { limit: 25 }),
    getEarthGeographyCatalogStatus(user.id, workspace.id),
  ]);
  const datasetLabels = status.datasets.flatMap((dataset) => dataset.versions
    .filter((version) => version.status === "ACTIVE")
    .map((version) => `${dataset.provider} ${version.version}`));
  const rawPlaceId = typeof params.place === "string" ? params.place : undefined;
  const parsedPlaceId = earthPlaceIdSchema.safeParse(rawPlaceId);
  let initialSelection = null;
  if (parsedPlaceId.success) {
    try {
      initialSelection = await getEarthPlace(user.id, workspace.id, parsedPlaceId.data);
    } catch {
      initialSelection = null;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Map}
        title="Earth Geography Explorer"
        description="Navigate verified country, state and point-only locality data. Land acquisition, ownership and construction are not available."
      />
      <GeographyExplorer
        initialCountries={countries.items}
        initialPlaceCount={status.placeCount}
        datasetLabels={datasetLabels}
        initialSelection={initialSelection}
      />
    </div>
  );
}
