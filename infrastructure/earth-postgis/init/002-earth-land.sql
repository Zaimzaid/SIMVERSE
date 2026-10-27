BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE earth_geo.steward (
  user_id text PRIMARY KEY,
  role text NOT NULL DEFAULT 'STEWARD',
  can_activate boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  granted_by_user_id text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (role IN ('STEWARD', 'REVIEWER', 'ADMIN')),
  CHECK ((is_active AND revoked_at IS NULL) OR (NOT is_active))
);

CREATE TABLE earth_geo.development_zone (
  id text PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  canonical_key text NOT NULL UNIQUE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  place_id text NOT NULL REFERENCES earth_geo.place(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'ACTIVE', 'RETIRED')),
  active_version_id text UNIQUE,
  is_demonstration boolean NOT NULL DEFAULT false,
  created_by_user_id text NOT NULL REFERENCES earth_geo.steward(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'ACTIVE' AND active_version_id IS NOT NULL) OR status <> 'ACTIVE')
);

CREATE TABLE earth_geo.development_zone_version (
  id text PRIMARY KEY,
  public_id text NOT NULL UNIQUE,
  zone_id text NOT NULL REFERENCES earth_geo.development_zone(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEW', 'ACTIVE', 'RETIRED')),
  source_place_revision_id text NOT NULL REFERENCES earth_geo.place_revision(id) ON DELETE RESTRICT,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  projection_srid integer NOT NULL CHECK (
    projection_srid BETWEEN 32601 AND 32660
    OR projection_srid BETWEEN 32701 AND 32760
  ),
  grid_origin geometry(Point, 4326) NOT NULL,
  grid_origin_easting double precision NOT NULL,
  grid_origin_northing double precision NOT NULL,
  grid_bearing_degrees double precision NOT NULL DEFAULT 0 CHECK (
    grid_bearing_degrees BETWEEN -180 AND 180
  ),
  cell_width_meters double precision NOT NULL DEFAULT 25 CHECK (
    cell_width_meters BETWEEN 10 AND 1000
  ),
  cell_height_meters double precision NOT NULL DEFAULT 25 CHECK (
    cell_height_meters BETWEEN 10 AND 1000
  ),
  algorithm_version text NOT NULL DEFAULT 'earth-parcel-grid-v1' CHECK (
    algorithm_version = 'earth-parcel-grid-v1'
  ),
  edge_policy text NOT NULL DEFAULT 'FULL_CELL' CHECK (edge_policy = 'FULL_CELL'),
  restrictions jsonb NOT NULL,
  provenance jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  review_note text,
  created_by_user_id text NOT NULL REFERENCES earth_geo.steward(user_id) ON DELETE RESTRICT,
  reviewed_by_user_id text REFERENCES earth_geo.steward(user_id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_IsValid(geometry)),
  CHECK (NOT ST_IsEmpty(geometry)),
  CHECK (ST_SRID(geometry) = 4326),
  CHECK (ST_SRID(grid_origin) = 4326),
  CHECK (ST_XMax(Box2D(geometry)) - ST_XMin(Box2D(geometry)) < 180),
  UNIQUE (id, zone_id),
  UNIQUE (zone_id, version),
  UNIQUE (zone_id, content_hash)
);

ALTER TABLE earth_geo.development_zone
  ADD CONSTRAINT development_zone_active_version_fk
  FOREIGN KEY (active_version_id, id)
  REFERENCES earth_geo.development_zone_version(id, zone_id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE earth_geo.development_zone_exclusion (
  id text PRIMARY KEY,
  zone_version_id text NOT NULL REFERENCES earth_geo.development_zone_version(id) ON DELETE RESTRICT,
  exclusion_key text NOT NULL,
  name text NOT NULL,
  reason text NOT NULL,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ST_IsValid(geometry)),
  CHECK (NOT ST_IsEmpty(geometry)),
  CHECK (ST_SRID(geometry) = 4326),
  UNIQUE (zone_version_id, exclusion_key)
);

CREATE TABLE earth_geo.development_zone_lifecycle_event (
  id text PRIMARY KEY,
  zone_id text NOT NULL REFERENCES earth_geo.development_zone(id) ON DELETE RESTRICT,
  zone_version_id text NOT NULL,
  action text NOT NULL CHECK (action IN (
    'CREATED', 'VERSION_CREATED', 'SUBMITTED_FOR_REVIEW',
    'ACTIVATED', 'RETIRED', 'ROLLED_BACK'
  )),
  actor_user_id text NOT NULL REFERENCES earth_geo.steward(user_id) ON DELETE RESTRICT,
  from_status text CHECK (from_status IS NULL OR from_status IN ('DRAFT', 'REVIEW', 'ACTIVE', 'RETIRED')),
  to_status text NOT NULL CHECK (to_status IN ('DRAFT', 'REVIEW', 'ACTIVE', 'RETIRED')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (zone_version_id, zone_id)
    REFERENCES earth_geo.development_zone_version(id, zone_id)
    ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION earth_geo.validate_development_zone_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_geometry geometry;
  parent_place_id text;
  expected_origin geometry;
BEGIN
  SELECT revision.geometry, revision.place_id
    INTO parent_geometry, parent_place_id
  FROM earth_geo.place_revision AS revision
  WHERE revision.id = NEW.source_place_revision_id;

  IF parent_geometry IS NULL
     OR GeometryType(parent_geometry) NOT IN ('POLYGON', 'MULTIPOLYGON') THEN
    RAISE EXCEPTION 'Development zones require a polygon or multipolygon parent revision';
  END IF;

  IF parent_place_id <> (
    SELECT place_id FROM earth_geo.development_zone WHERE id = NEW.zone_id
  ) THEN
    RAISE EXCEPTION 'Source revision does not belong to the zone parent place';
  END IF;

  IF NOT ST_CoveredBy(NEW.geometry, ST_Multi(parent_geometry)) THEN
    RAISE EXCEPTION 'Development-zone geometry is outside its parent geography';
  END IF;

  IF NOT ST_CoveredBy(NEW.grid_origin, NEW.geometry) THEN
    RAISE EXCEPTION 'Grid origin is outside the development-zone geometry';
  END IF;

  expected_origin := ST_Transform(NEW.grid_origin, NEW.projection_srid);
  IF abs(ST_X(expected_origin) - NEW.grid_origin_easting) > 0.01
     OR abs(ST_Y(expected_origin) - NEW.grid_origin_northing) > 0.01 THEN
    RAISE EXCEPTION 'Stored metric grid origin does not match its WGS84 origin and projection';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER development_zone_version_validate
BEFORE INSERT ON earth_geo.development_zone_version
FOR EACH ROW EXECUTE FUNCTION earth_geo.validate_development_zone_version();

CREATE OR REPLACE FUNCTION earth_geo.protect_development_zone_version_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.zone_id IS DISTINCT FROM OLD.zone_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.source_place_revision_id IS DISTINCT FROM OLD.source_place_revision_id
     OR NOT ST_OrderingEquals(NEW.geometry, OLD.geometry)
     OR NEW.projection_srid IS DISTINCT FROM OLD.projection_srid
     OR NOT ST_OrderingEquals(NEW.grid_origin, OLD.grid_origin)
     OR NEW.grid_origin_easting IS DISTINCT FROM OLD.grid_origin_easting
     OR NEW.grid_origin_northing IS DISTINCT FROM OLD.grid_origin_northing
     OR NEW.grid_bearing_degrees IS DISTINCT FROM OLD.grid_bearing_degrees
     OR NEW.cell_width_meters IS DISTINCT FROM OLD.cell_width_meters
     OR NEW.cell_height_meters IS DISTINCT FROM OLD.cell_height_meters
     OR NEW.algorithm_version IS DISTINCT FROM OLD.algorithm_version
     OR NEW.edge_policy IS DISTINCT FROM OLD.edge_policy
     OR NEW.restrictions IS DISTINCT FROM OLD.restrictions
     OR NEW.provenance IS DISTINCT FROM OLD.provenance
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
    RAISE EXCEPTION 'Immutable development-zone version content cannot be changed';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER development_zone_version_immutable
BEFORE UPDATE ON earth_geo.development_zone_version
FOR EACH ROW EXECUTE FUNCTION earth_geo.protect_development_zone_version_content();

CREATE OR REPLACE FUNCTION earth_geo.validate_development_zone_exclusion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  zone_geometry geometry;
BEGIN
  SELECT geometry INTO zone_geometry
  FROM earth_geo.development_zone_version
  WHERE id = NEW.zone_version_id;

  IF zone_geometry IS NULL OR NOT ST_CoveredBy(NEW.geometry, zone_geometry) THEN
    RAISE EXCEPTION 'Development-zone exclusion must be inside its immutable zone version';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER development_zone_exclusion_validate
BEFORE INSERT OR UPDATE ON earth_geo.development_zone_exclusion
FOR EACH ROW EXECUTE FUNCTION earth_geo.validate_development_zone_exclusion();

CREATE INDEX development_zone_place_status_idx
  ON earth_geo.development_zone(place_id, status, name);
CREATE INDEX development_zone_version_zone_status_idx
  ON earth_geo.development_zone_version(zone_id, status, version);
CREATE INDEX development_zone_version_geometry_gist_idx
  ON earth_geo.development_zone_version USING GIST (geometry);
CREATE INDEX development_zone_exclusion_geometry_gist_idx
  ON earth_geo.development_zone_exclusion USING GIST (geometry);
CREATE UNIQUE INDEX development_zone_one_active_version_idx
  ON earth_geo.development_zone_version(zone_id) WHERE status = 'ACTIVE';
CREATE INDEX development_zone_lifecycle_zone_created_idx
  ON earth_geo.development_zone_lifecycle_event(zone_id, created_at);

COMMIT;
