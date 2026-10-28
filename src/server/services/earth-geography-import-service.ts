import { randomUUID } from "node:crypto";
import type { EarthGeoDataset, PrismaClient } from "@prisma/client";
import {
  readNigeriaGeographyBundle,
  sha256Text,
  stableStringify,
  type EarthGeographyBundle,
  type EarthSourceManifestEntry,
} from "../../lib/earth/import.ts";

function assertImmutableDataset(dataset: EarthGeoDataset, source: EarthSourceManifestEntry) {
  const expected = {
    name: source.providerName,
    sourceUrl: source.sourceUrl,
    licenseName: source.licenseName,
    licenseUrl: source.licenseUrl,
    attribution: source.attribution,
  } as const;
  for (const [key, value] of Object.entries(expected)) {
    if (dataset[key as keyof typeof expected] !== value) {
      throw new Error(
        `Dataset ${source.providerKey}/${source.releaseType} changed immutable ${key}. Add a new releaseType instead.`,
      );
    }
  }
}

async function ensureDatasetVersion(
  db: PrismaClient,
  source: EarthSourceManifestEntry,
  manifestChecksum: string,
) {
  let dataset = await db.earthGeoDataset.findUnique({
    where: {
      providerKey_releaseType: {
        providerKey: source.providerKey,
        releaseType: source.releaseType,
      },
    },
  });
  if (dataset) {
    assertImmutableDataset(dataset, source);
  } else {
    dataset = await db.earthGeoDataset.create({
      data: {
        providerKey: source.providerKey,
        releaseType: source.releaseType,
        name: source.providerName,
        sourceUrl: source.sourceUrl,
        licenseName: source.licenseName,
        licenseUrl: source.licenseUrl,
        attribution: source.attribution,
      },
    });
  }

  const sourceMetadata = stableStringify(source);
  let version = await db.earthGeoDatasetVersion.findUnique({
    where: {
      datasetId_versionKey: {
        datasetId: dataset.id,
        versionKey: source.versionKey,
      },
    },
  });
  if (version) {
    if (
      version.manifestChecksum !== manifestChecksum
      || version.sourceRevision !== source.sourceRevision
      || version.sourceMetadata !== sourceMetadata
    ) {
      throw new Error(
        `Dataset version ${source.versionKey} is immutable and does not match the source manifest.`,
      );
    }
  } else {
    version = await db.earthGeoDatasetVersion.create({
      data: {
        datasetId: dataset.id,
        versionKey: source.versionKey,
        sourceRevision: source.sourceRevision,
        manifestChecksum,
        sourceMetadata,
        status: "STAGED",
      },
    });
  }
  return { dataset, version };
}

async function importSource(
  db: PrismaClient,
  bundle: EarthGeographyBundle,
  source: EarthSourceManifestEntry,
) {
  const { dataset, version } = await ensureDatasetVersion(db, source, bundle.manifestChecksum);
  const records = bundle.records.filter(
    (record) => record.datasetVersionKey === source.versionKey,
  );
  const sourceChecksum = `sha256:${sha256Text(
    source.layers.map((layer) => layer.sha256).join(":"),
  )}`;
  const importRun = await db.earthGeoImport.create({
    data: {
      datasetVersionId: version.id,
      importKey: `${source.versionKey}:${Date.now()}:${randomUUID()}`,
      status: "RUNNING",
      sourceManifest: stableStringify(source),
      sourceChecksum,
      recordsRead: records.length,
    },
  });

  try {
    const counts = await db.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const record of records) {
        const parent = record.parentCanonicalKey
          ? await tx.earthGeoPlace.findUnique({
            where: { canonicalKey: record.parentCanonicalKey },
          })
          : null;
        if (record.parentCanonicalKey && !parent) {
          throw new Error(
            `Missing parent ${record.parentCanonicalKey} for ${record.canonicalKey}.`,
          );
        }

        let place = await tx.earthGeoPlace.findUnique({
          where: { canonicalKey: record.canonicalKey },
        });
        if (!place) {
          place = await tx.earthGeoPlace.create({
            data: {
              publicId: record.publicId,
              canonicalKey: record.canonicalKey,
              parentId: parent?.id ?? null,
              kind: record.kind,
              name: record.name,
              normalizedName: record.normalizedName,
              isoAlpha2: record.isoAlpha2,
              isoAlpha3: record.isoAlpha3,
              adminLevel: record.adminLevel,
              sourceProvider: record.sourceProvider,
              sourceFeatureId: record.sourceFeatureId,
            },
          });
          created += 1;
        } else {
          if (
            place.publicId !== record.publicId
            || place.sourceProvider !== record.sourceProvider
          ) {
            throw new Error(`Stable identity conflict for ${record.canonicalKey}.`);
          }
          await tx.earthGeoPlace.update({
            where: { id: place.id },
            data: {
              parentId: parent?.id ?? null,
              kind: record.kind,
              name: record.name,
              normalizedName: record.normalizedName,
              isoAlpha2: record.isoAlpha2,
              isoAlpha3: record.isoAlpha3,
              adminLevel: record.adminLevel,
              sourceFeatureId: record.sourceFeatureId,
            },
          });
        }

        const existingVersionRevision = await tx.earthGeoPlaceRevision.findUnique({
          where: {
            placeId_datasetVersionId: {
              placeId: place.id,
              datasetVersionId: version.id,
            },
          },
        });
        if (existingVersionRevision) {
          if (existingVersionRevision.contentHash !== record.contentHash) {
            throw new Error(
              `Immutable revision conflict for ${record.canonicalKey} in ${source.versionKey}.`,
            );
          }
          await tx.earthGeoPlaceRevision.updateMany({
            where: { placeId: place.id, id: { not: existingVersionRevision.id } },
            data: { isCurrent: false },
          });
          await tx.earthGeoPlaceRevision.update({
            where: { id: existingVersionRevision.id },
            data: { isCurrent: true },
          });
          skipped += 1;
          continue;
        }

        const latest = await tx.earthGeoPlaceRevision.findFirst({
          where: { placeId: place.id },
          orderBy: { revision: "desc" },
        });
        await tx.earthGeoPlaceRevision.updateMany({
          where: { placeId: place.id, isCurrent: true },
          data: { isCurrent: false },
        });
        await tx.earthGeoPlaceRevision.create({
          data: {
            placeId: place.id,
            datasetVersionId: version.id,
            revision: (latest?.revision ?? 0) + 1,
            sourceBoundaryId: record.sourceBoundaryId,
            sourceName: record.sourceName,
            geometryType: record.geometryType,
            geometryGeoJson: record.geometryGeoJson,
            bboxWest: record.bbox.west,
            bboxSouth: record.bbox.south,
            bboxEast: record.bbox.east,
            bboxNorth: record.bbox.north,
            labelLongitude: record.label.longitude,
            labelLatitude: record.label.latitude,
            coordinateReferenceSystem: record.coordinateReferenceSystem,
            boundaryQuality: record.boundaryQuality,
            verificationStatus: record.verificationStatus,
            sourceProperties: record.sourceProperties,
            contentHash: record.contentHash,
            isCurrent: true,
          },
        });
        if (latest) updated += 1;
      }

      await tx.earthGeoDatasetVersion.updateMany({
        where: {
          datasetId: dataset.id,
          id: { not: version.id },
          status: "ACTIVE",
        },
        data: { status: "SUPERSEDED" },
      });
      await tx.earthGeoDatasetVersion.update({
        where: { id: version.id },
        data: {
          status: "ACTIVE",
          importedAt: new Date(),
          activatedAt: new Date(),
        },
      });
      return { created, updated, skipped };
    }, { timeout: records.length > 100 ? 120_000 : 20_000 });

    await db.earthGeoImport.update({
      where: { id: importRun.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        recordsCreated: counts.created,
        recordsUpdated: counts.updated,
        recordsSkipped: counts.skipped,
      },
    });
    return {
      provider: source.providerKey,
      version: source.versionKey,
      records: records.length,
      ...counts,
    };
  } catch (error) {
    await db.earthGeoImport.update({
      where: { id: importRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorSummary: error instanceof Error
          ? error.message.slice(0, 2000)
          : "Unknown import failure",
      },
    });
    throw error;
  }
}

/**
 * Import the pinned Nigeria proof catalog. Calling this repeatedly is safe:
 * existing immutable revisions are verified and reported as skipped.
 */
export async function importEarthGeography(
  db: PrismaClient,
  projectRoot = process.cwd(),
) {
  const bundle = await readNigeriaGeographyBundle(projectRoot);
  const imported = await importEarthGeographyBundle(db, bundle);
  const lagos = await db.earthGeoPlace.findFirst({
    where: { name: "Lagos", kind: "ADMIN1", isoAlpha3: "NGA" },
    include: { revisions: { where: { isCurrent: true }, take: 1 } },
  });
  return {
    ...imported,
    demonstration: lagos ? {
      publicId: lagos.publicId,
      kind: lagos.kind,
      boundaryQuality: lagos.revisions[0]?.boundaryQuality,
    } : null,
  };
}

/** Persist any already validated manifest-driven geography bundle. */
export async function importEarthGeographyBundle(
  db: PrismaClient,
  bundle: EarthGeographyBundle,
) {
  const results = [];
  for (const source of bundle.sources) {
    results.push(await importSource(db, bundle, source));
  }
  return {
    manifestChecksum: bundle.manifestChecksum,
    totalRecords: bundle.records.length,
    results,
  };
}
