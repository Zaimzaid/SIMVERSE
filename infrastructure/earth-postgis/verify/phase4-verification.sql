\echo 'Earth Phase 4 PostGIS land-subdivision verification'

SELECT current_database() AS database_name,
       current_setting('server_version') AS postgresql_version,
       PostGIS_Full_Version() AS postgis_full_version;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS extension is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'pgcrypto extension is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'development_zone_version_geometry_gist_idx'
      AND indexdef ILIKE '%USING gist%'
  ) THEN
    RAISE EXCEPTION 'Development-zone geometry GiST index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'development_zone_exclusion_geometry_gist_idx'
      AND indexdef ILIKE '%USING gist%'
  ) THEN
    RAISE EXCEPTION 'Development-zone exclusion GiST index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'development_zone_one_active_version_idx'
      AND indexdef ILIKE '%WHERE (status = ''ACTIVE''%'
  ) THEN
    RAISE EXCEPTION 'One-active-version partial index is missing';
  END IF;
END
$$;

INSERT INTO earth_geo.place (
  id, public_id, canonical_key, parent_id, kind, name, normalized_name,
  iso_alpha2, iso_alpha3, admin_level, source_provider, source_feature_id
) VALUES (
  'place-phase4-lagos', 'geo_phase4_lagos', 'phase4:synthetic:lagos-state',
  'place-country', 'ADMIN1', 'Lagos Phase 4 Context', 'lagos phase 4 context',
  'NG', 'NGA', 1, 'phase4-ci', 'lagos-context'
);

INSERT INTO earth_geo.place_revision (
  id, place_id, dataset_version_id, revision, source_boundary_id,
  source_name, geometry_type, geometry, boundary_quality,
  verification_status, source_properties, content_hash
) VALUES (
  'revision-phase4-parent', 'place-phase4-lagos', 'dataset-version-1', 1,
  'phase4-parent', 'Synthetic Lagos-positioned parent', 'MultiPolygon',
  ST_Multi(ST_GeomFromText(
    'POLYGON((3.39 6.54,3.42 6.54,3.42 6.57,3.39 6.57,3.39 6.54))', 4326
  )),
  'APPROXIMATE_BOUNDARY', 'PENDING_REVIEW',
  '{"synthetic":true,"purpose":"Phase 4 PostGIS verification only"}'::jsonb,
  'sha256:4444444444444444444444444444444444444444444444444444444444444444'
);

INSERT INTO earth_geo.steward (
  user_id, role, can_activate, is_active
) VALUES (
  'phase4-steward', 'ADMIN', true, true
);

INSERT INTO earth_geo.development_zone (
  id, public_id, canonical_key, name, normalized_name, place_id,
  status, is_demonstration, created_by_user_id
) VALUES (
  'zone-phase4', 'zone_111111111111111111111111',
  'earth:zone:phase4-postgis-fixture', 'Phase 4 synthetic test zone',
  'phase 4 synthetic test zone', 'place-phase4-lagos',
  'REVIEW', true, 'phase4-steward'
);

INSERT INTO earth_geo.development_zone_version (
  id, public_id, zone_id, version, status, source_place_revision_id,
  geometry, projection_srid, grid_origin,
  grid_origin_easting, grid_origin_northing, grid_bearing_degrees,
  cell_width_meters, cell_height_meters, algorithm_version, edge_policy,
  restrictions, provenance, content_hash, created_by_user_id, submitted_at
)
SELECT
  'zone-version-phase4-1', 'zonev_111111111111111111111111',
  'zone-phase4', 1, 'REVIEW', 'revision-phase4-parent',
  ST_Multi(ST_GeomFromText(
    'POLYGON((3.3998 6.5498,3.4032 6.5498,3.4032 6.5532,3.3998 6.5532,3.3998 6.5498))', 4326
  )),
  32631,
  ST_SetSRID(ST_MakePoint(3.4, 6.55), 4326),
  ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(3.4, 6.55), 4326), 32631)),
  ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(3.4, 6.55), 4326), 32631)),
  0, 25, 25, 'earth-parcel-grid-v1', 'FULL_CELL',
  '{"zoningCode":"PHASE4-TEST","allowedUses":["verification"]}'::jsonb,
  '{"isSynthetic":true,"label":"Not cadastral or real land"}'::jsonb,
  'sha256:5555555555555555555555555555555555555555555555555555555555555555',
  'phase4-steward', now();

INSERT INTO earth_geo.development_zone_exclusion (
  id, zone_version_id, exclusion_key, name, reason, geometry
) VALUES (
  'zone-exclusion-phase4', 'zone-version-phase4-1', 'synthetic-reserve',
  'Synthetic reserve', 'Verifies full-cell exclusion behavior',
  ST_Multi(ST_GeomFromText(
    'POLYGON((3.4010 6.5510,3.4015 6.5510,3.4015 6.5515,3.4010 6.5515,3.4010 6.5510))', 4326
  ))
);

BEGIN;
  UPDATE earth_geo.development_zone_version
  SET status = 'ACTIVE', reviewed_by_user_id = 'phase4-steward', activated_at = now()
  WHERE id = 'zone-version-phase4-1';
  UPDATE earth_geo.development_zone
  SET status = 'ACTIVE', active_version_id = 'zone-version-phase4-1'
  WHERE id = 'zone-phase4';
  INSERT INTO earth_geo.development_zone_lifecycle_event (
    id, zone_id, zone_version_id, action, actor_user_id, from_status, to_status
  ) VALUES (
    'zone-event-phase4-active', 'zone-phase4', 'zone-version-phase4-1',
    'ACTIVATED', 'phase4-steward', 'REVIEW', 'ACTIVE'
  );
COMMIT;

DO $$
DECLARE
  zone_geometry geometry;
  exclusion_geometry geometry;
  origin geometry;
  cell geometry;
  side_one double precision;
  side_two double precision;
  cell_area double precision;
  stable_id_one text;
  stable_id_two text;
  generated_count integer;
  overlap_count integer;
BEGIN
  SELECT geometry INTO zone_geometry
  FROM earth_geo.development_zone_version WHERE id = 'zone-version-phase4-1';
  SELECT geometry INTO exclusion_geometry
  FROM earth_geo.development_zone_exclusion WHERE id = 'zone-exclusion-phase4';
  SELECT ST_Transform(grid_origin, projection_srid) INTO origin
  FROM earth_geo.development_zone_version WHERE id = 'zone-version-phase4-1';

  cell := ST_MakeEnvelope(
    ST_X(origin), ST_Y(origin), ST_X(origin) + 25, ST_Y(origin) + 25, 32631
  );
  side_one := ST_Distance(ST_PointN(ST_ExteriorRing(cell), 1), ST_PointN(ST_ExteriorRing(cell), 2));
  side_two := ST_Distance(ST_PointN(ST_ExteriorRing(cell), 2), ST_PointN(ST_ExteriorRing(cell), 3));
  cell_area := ST_Area(cell);

  IF abs(side_one - 25) > 0.001 OR abs(side_two - 25) > 0.001 THEN
    RAISE EXCEPTION 'Generated cell sides are not 25 metres: %, %', side_one, side_two;
  END IF;
  IF abs(cell_area - 625) > 0.001 THEN
    RAISE EXCEPTION 'Generated cell area is not 625 square metres: %', cell_area;
  END IF;
  IF NOT ST_CoveredBy(ST_Transform(cell, 4326), zone_geometry) THEN
    RAISE EXCEPTION 'Expected origin cell is not covered by the development zone';
  END IF;

  stable_id_one := 'parcel_' || substring(encode(digest(
    'earth-parcel-grid-v1:zonev_111111111111111111111111:0:0', 'sha256'
  ), 'hex') FROM 1 FOR 32);
  stable_id_two := 'parcel_' || substring(encode(digest(
    'earth-parcel-grid-v1:zonev_111111111111111111111111:0:0', 'sha256'
  ), 'hex') FROM 1 FOR 32);
  IF stable_id_one <> stable_id_two OR stable_id_one !~ '^parcel_[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'Stable parcel identifier derivation failed';
  END IF;

  WITH cells AS (
    SELECT column_index, row_index,
           ST_MakeEnvelope(
             ST_X(origin) + column_index * 25,
             ST_Y(origin) + row_index * 25,
             ST_X(origin) + (column_index + 1) * 25,
             ST_Y(origin) + (row_index + 1) * 25,
             32631
           ) AS metric_geometry
    FROM generate_series(-2, 16) AS column_index
    CROSS JOIN generate_series(-2, 16) AS row_index
  ), eligible AS (
    SELECT column_index, row_index, metric_geometry
    FROM cells
    WHERE ST_CoveredBy(ST_Transform(metric_geometry, 4326), zone_geometry)
      AND NOT ST_Intersects(ST_Transform(metric_geometry, 4326), exclusion_geometry)
  )
  SELECT count(*) INTO generated_count FROM eligible;

  IF generated_count < 20 OR generated_count > 361 THEN
    RAISE EXCEPTION 'Unexpected bounded eligible parcel count: %', generated_count;
  END IF;

  WITH cells AS (
    SELECT column_index, row_index,
           ST_MakeEnvelope(
             ST_X(origin) + column_index * 25,
             ST_Y(origin) + row_index * 25,
             ST_X(origin) + (column_index + 1) * 25,
             ST_Y(origin) + (row_index + 1) * 25,
             32631
           ) AS metric_geometry
    FROM generate_series(0, 2) AS column_index
    CROSS JOIN generate_series(0, 2) AS row_index
  )
  SELECT count(*) INTO overlap_count
  FROM cells AS first
  JOIN cells AS second
    ON (first.row_index, first.column_index) < (second.row_index, second.column_index)
   AND ST_Overlaps(first.metric_geometry, second.metric_geometry);

  IF overlap_count <> 0 THEN
    RAISE EXCEPTION 'Generated grid cells overlap';
  END IF;

  RAISE NOTICE 'PASS: % bounded full cells; 25 m sides; 625 m2; stable id %',
    generated_count, stable_id_one;
END
$$;

INSERT INTO earth_geo.development_zone_version (
  id, public_id, zone_id, version, status, source_place_revision_id,
  geometry, projection_srid, grid_origin,
  grid_origin_easting, grid_origin_northing,
  cell_width_meters, cell_height_meters, restrictions, provenance,
  content_hash, created_by_user_id
)
SELECT
  'zone-version-phase4-2', 'zonev_222222222222222222222222',
  'zone-phase4', 2, 'DRAFT', 'revision-phase4-parent',
  ST_GeomFromText(
    'MULTIPOLYGON(((3.4000 6.5500,3.4009 6.5500,3.4009 6.5509,3.4000 6.5509,3.4000 6.5500),(3.4003 6.5503,3.4005 6.5503,3.4005 6.5505,3.4003 6.5505,3.4003 6.5503)),((3.4020 6.5520,3.4028 6.5520,3.4028 6.5528,3.4020 6.5528,3.4020 6.5520)))',
    4326
  ),
  32631,
  ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326),
  ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 32631)),
  ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 32631)),
  25, 25, '{"zoningCode":"PHASE4-MULTI"}'::jsonb,
  '{"isSynthetic":true,"geometryCases":["hole","multipolygon"]}'::jsonb,
  'sha256:6666666666666666666666666666666666666666666666666666666666666666',
  'phase4-steward';

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    UPDATE earth_geo.development_zone_version
    SET cell_width_meters = 50
    WHERE id = 'zone-version-phase4-1';
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: immutable zone-version content update rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Immutable zone version was changed'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_version (
      id, public_id, zone_id, version, status, source_place_revision_id,
      geometry, projection_srid, grid_origin, grid_origin_easting, grid_origin_northing,
      restrictions, provenance, content_hash, created_by_user_id
    ) VALUES (
      'zone-version-invalid-geometry', 'zonev_cccccccccccccccccccccccc',
      'zone-phase4', 97, 'DRAFT', 'revision-phase4-parent',
      ST_Multi(ST_GeomFromText(
        'POLYGON((3.4000 6.5500,3.4030 6.5530,3.4030 6.5500,3.4000 6.5530,3.4000 6.5500))',
        4326
      )),
      32631, ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326),
      ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 32631)),
      ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 32631)),
      '{}'::jsonb, '{"synthetic":true}'::jsonb,
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'phase4-steward'
    );
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: invalid self-intersecting zone geometry rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Invalid self-intersecting zone geometry was accepted'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_version (
      id, public_id, zone_id, version, status, source_place_revision_id,
      geometry, projection_srid, grid_origin, grid_origin_easting, grid_origin_northing,
      restrictions, provenance, content_hash, created_by_user_id
    ) VALUES (
      'zone-version-invalid-projection', 'zonev_dddddddddddddddddddddddd',
      'zone-phase4', 96, 'DRAFT', 'revision-phase4-parent',
      ST_Multi(ST_GeomFromText(
        'POLYGON((3.4000 6.5500,3.4010 6.5500,3.4010 6.5510,3.4000 6.5510,3.4000 6.5500))',
        4326
      )),
      3857, ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326),
      ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 3857)),
      ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(3.4001, 6.5501), 4326), 3857)),
      '{}'::jsonb, '{"synthetic":true}'::jsonb,
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'phase4-steward'
    );
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: unsupported non-UTM projection rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Unsupported non-UTM projection was accepted'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_version (
      id, public_id, zone_id, version, status, source_place_revision_id,
      geometry, projection_srid, grid_origin, grid_origin_easting, grid_origin_northing,
      restrictions, provenance, content_hash, created_by_user_id
    ) VALUES (
      'zone-version-invalid-point', 'zonev_aaaaaaaaaaaaaaaaaaaaaaaa',
      'zone-phase4', 99, 'DRAFT', 'revision-phase4-parent',
      ST_Multi(ST_SetSRID(ST_MakePoint(3.4, 6.55), 4326)), 32631,
      ST_SetSRID(ST_MakePoint(3.4, 6.55), 4326), 0, 0,
      '{}'::jsonb, '{"synthetic":true}'::jsonb,
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'phase4-steward'
    );
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: point-only development-zone geometry rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Point-only zone geometry was accepted'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_exclusion (
      id, zone_version_id, exclusion_key, name, reason, geometry
    ) VALUES (
      'zone-exclusion-outside', 'zone-version-phase4-1', 'outside',
      'Outside exclusion', 'Must be rejected',
      ST_Multi(ST_GeomFromText(
        'POLYGON((3.41 6.56,3.411 6.56,3.411 6.561,3.41 6.561,3.41 6.56))', 4326
      ))
    );
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: exclusion outside zone rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Outside exclusion was accepted'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_version (
      id, public_id, zone_id, version, status, source_place_revision_id,
      geometry, projection_srid, grid_origin, grid_origin_easting, grid_origin_northing,
      restrictions, provenance, content_hash, created_by_user_id
    )
    SELECT
      'zone-version-invalid-parent', 'zonev_bbbbbbbbbbbbbbbbbbbbbbbb',
      'zone-phase4', 98, 'DRAFT', 'revision-phase4-parent',
      ST_Multi(ST_GeomFromText(
        'POLYGON((4 7,4.01 7,4.01 7.01,4 7.01,4 7))', 4326
      )),
      32631, ST_SetSRID(ST_MakePoint(4.001, 7.001), 4326),
      ST_X(ST_Transform(ST_SetSRID(ST_MakePoint(4.001, 7.001), 4326), 32631)),
      ST_Y(ST_Transform(ST_SetSRID(ST_MakePoint(4.001, 7.001), 4326), 32631)),
      '{}'::jsonb, '{"synthetic":true}'::jsonb,
      'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'phase4-steward';
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: out-of-parent zone rejected (%)', SQLERRM;
  END;
  IF accepted THEN RAISE EXCEPTION 'Out-of-parent zone was accepted'; END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.development_zone_lifecycle_event (
      id, zone_id, zone_version_id, action, actor_user_id, to_status
    ) VALUES (
      'zone-event-orphan', 'missing-zone', 'zone-version-phase4-1',
      'RETIRED', 'phase4-steward', 'RETIRED'
    );
    accepted := true;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: lifecycle foreign keys reject mismatched/orphan records';
  END;
  IF accepted THEN RAISE EXCEPTION 'Orphan lifecycle event was accepted'; END IF;
END
$$;

SELECT 'PASS: valid polygon, multipolygon, and hole geometries persisted' AS result,
       count(*) AS version_count
FROM earth_geo.development_zone_version
WHERE zone_id = 'zone-phase4';

SELECT 'PASS: active version and lifecycle record persisted' AS result,
       zone.status, version.version, event.action
FROM earth_geo.development_zone AS zone
JOIN earth_geo.development_zone_version AS version
  ON version.id = zone.active_version_id
JOIN earth_geo.development_zone_lifecycle_event AS event
  ON event.zone_id = zone.id AND event.zone_version_id = version.id
WHERE zone.id = 'zone-phase4';

\echo 'PASS: all Earth Phase 4 PostGIS checks completed'
