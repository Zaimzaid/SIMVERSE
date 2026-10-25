BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS earth_geo;

CREATE TABLE earth_geo.dataset (
  id text PRIMARY KEY,
  provider_key text NOT NULL,
  release_type text NOT NULL,
  name text NOT NULL,
  source_url text NOT NULL,
  license_name text NOT NULL,
  license_url text NOT NULL,
  attribution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_key, release_type)
);

CREATE TABLE earth_geo.dataset_version (
  id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES earth_geo.dataset(id) ON DELETE RESTRICT,
  version_key text NOT NULL,
  source_revision text NOT NULL,
  status text NOT NULL CHECK (status IN ('STAGED', 'ACTIVE', 'SUPERSEDED', 'QUARANTINED')),
  manifest_checksum text NOT NULL CHECK (manifest_checksum ~ '^sha256:[0-9a-f]{64}$'),
  source_metadata jsonb NOT NULL,
  imported_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, version_key)
);

CREATE TABLE earth_geo.place (
  id text PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  canonical_key text NOT NULL UNIQUE,
  parent_id text REFERENCES earth_geo.place(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('COUNTRY', 'ADMIN1', 'ADMIN2', 'CITY', 'TOWN', 'LOCALITY')),
  name text NOT NULL,
  normalized_name text NOT NULL,
  iso_alpha2 text,
  iso_alpha3 text,
  admin_level integer,
  source_provider text NOT NULL,
  source_feature_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE earth_geo.place_revision (
  id text PRIMARY KEY,
  place_id text NOT NULL REFERENCES earth_geo.place(id) ON DELETE RESTRICT,
  dataset_version_id text NOT NULL REFERENCES earth_geo.dataset_version(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  source_boundary_id text,
  source_name text NOT NULL,
  geometry_type text NOT NULL CHECK (geometry_type IN ('Point', 'Polygon', 'MultiPolygon', 'None')),
  geometry geometry(Geometry, 4326),
  boundary_quality text NOT NULL CHECK (boundary_quality IN (
    'VERIFIED_BOUNDARY', 'GENERALIZED_BOUNDARY', 'APPROXIMATE_BOUNDARY',
    'DISPUTED_BOUNDARY', 'POINT_ONLY', 'MISSING', 'QUARANTINED'
  )),
  verification_status text NOT NULL CHECK (verification_status IN ('VERIFIED_SOURCE', 'PENDING_REVIEW', 'REJECTED')),
  source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (geometry IS NULL OR ST_SRID(geometry) = 4326),
  CHECK (geometry IS NULL OR ST_IsValid(geometry)),
  CHECK (
    (geometry_type = 'None' AND geometry IS NULL)
    OR (geometry IS NOT NULL AND geometry_type = 'Point' AND GeometryType(geometry) = 'POINT')
    OR (geometry IS NOT NULL AND geometry_type = 'Polygon' AND GeometryType(geometry) = 'POLYGON')
    OR (geometry IS NOT NULL AND geometry_type = 'MultiPolygon' AND GeometryType(geometry) = 'MULTIPOLYGON')
  ),
  UNIQUE (place_id, revision),
  UNIQUE (place_id, dataset_version_id)
);

CREATE TABLE earth_geo.import_run (
  id text PRIMARY KEY,
  dataset_version_id text NOT NULL REFERENCES earth_geo.dataset_version(id) ON DELETE RESTRICT,
  import_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
  source_manifest jsonb NOT NULL,
  source_checksum text NOT NULL CHECK (source_checksum ~ '^sha256:[0-9a-f]{64}$'),
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_created integer NOT NULL DEFAULT 0 CHECK (records_created >= 0),
  records_updated integer NOT NULL DEFAULT 0 CHECK (records_updated >= 0),
  records_skipped integer NOT NULL DEFAULT 0 CHECK (records_skipped >= 0),
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX place_parent_kind_name_idx ON earth_geo.place(parent_id, kind, name);
CREATE INDEX place_normalized_name_idx ON earth_geo.place(normalized_name);
CREATE INDEX place_revision_geometry_gist_idx ON earth_geo.place_revision USING GIST (geometry);
CREATE INDEX place_revision_dataset_idx ON earth_geo.place_revision(dataset_version_id);
CREATE INDEX place_revision_quality_idx ON earth_geo.place_revision(boundary_quality, verification_status);
CREATE UNIQUE INDEX place_revision_one_current_idx ON earth_geo.place_revision(place_id) WHERE is_current;

COMMIT;
