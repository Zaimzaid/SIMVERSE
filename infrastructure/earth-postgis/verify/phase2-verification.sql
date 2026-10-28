\echo 'Earth Phase 2 PostGIS constraint verification'

SELECT current_database() AS database_name,
       current_setting('server_version') AS postgresql_version,
       PostGIS_Lib_Version() AS postgis_version;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  ) THEN
    RAISE EXCEPTION 'PostGIS extension is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'place_revision_geometry_gist_idx'
      AND indexdef ILIKE '%USING gist%'
  ) THEN
    RAISE EXCEPTION 'Expected geometry GiST index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'place_parent_kind_name_idx'
  ) THEN
    RAISE EXCEPTION 'Expected hierarchy index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'earth_geo'
      AND indexname = 'place_revision_one_current_idx'
      AND indexdef ILIKE '%WHERE is_current%'
  ) THEN
    RAISE EXCEPTION 'Expected one-current-revision index is missing';
  END IF;
END
$$;

INSERT INTO earth_geo.dataset (
  id, provider_key, release_type, name, source_url,
  license_name, license_url, attribution
) VALUES (
  'dataset-fixture', 'phase2-ci', 'OPEN', 'Phase 2 verification fixture',
  'https://example.invalid/phase2', 'CC0-1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Synthetic geometry used only by the Phase 2 database gate.'
);

INSERT INTO earth_geo.dataset_version (
  id, dataset_id, version_key, source_revision, status,
  manifest_checksum, source_metadata, imported_at, activated_at
) VALUES (
  'dataset-version-1', 'dataset-fixture', 'v1', 'ci-fixture', 'ACTIVE',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"synthetic":true}'::jsonb, now(), now()
);

INSERT INTO earth_geo.place (
  id, public_id, canonical_key, kind, name, normalized_name,
  iso_alpha2, iso_alpha3, admin_level, source_provider, source_feature_id
) VALUES (
  'place-country', 'geo_ci_country', 'country:ci', 'COUNTRY',
  'Synthetic Country', 'synthetic country', 'XZ', 'XYZ', 0,
  'phase2-ci', 'country'
);

INSERT INTO earth_geo.place_revision (
  id, place_id, dataset_version_id, revision, source_boundary_id,
  source_name, geometry_type, geometry, boundary_quality,
  verification_status, content_hash
) VALUES (
  'revision-valid', 'place-country', 'dataset-version-1', 1, 'valid-polygon',
  'Synthetic Country', 'Polygon',
  ST_GeomFromText('POLYGON((3 6,4 6,4 7,3 6))', 4326),
  'APPROXIMATE_BOUNDARY', 'PENDING_REVIEW',
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
);

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.place_revision (
      id, place_id, dataset_version_id, revision, source_name,
      geometry_type, geometry, boundary_quality, verification_status, content_hash
    ) VALUES (
      'revision-invalid-shape', 'place-country', 'dataset-version-1', 2,
      'Invalid bow-tie', 'Polygon',
      ST_GeomFromText('POLYGON((0 0,1 1,1 0,0 1,0 0))', 4326),
      'APPROXIMATE_BOUNDARY', 'PENDING_REVIEW',
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    );
    accepted := true;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: invalid self-intersecting geometry rejected by CHECK constraint';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Invalid self-intersecting geometry was accepted';
  END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.place_revision (
      id, place_id, dataset_version_id, revision, source_name,
      geometry_type, geometry, boundary_quality, verification_status, content_hash
    ) VALUES (
      'revision-wrong-srid', 'place-country', 'dataset-version-1', 2,
      'Wrong SRID', 'Point', ST_SetSRID(ST_MakePoint(3, 6), 3857),
      'POINT_ONLY', 'PENDING_REVIEW',
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    );
    accepted := true;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: non-WGS84 geometry rejected (%)', SQLERRM;
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Non-WGS84 geometry was accepted';
  END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.place_revision (
      id, place_id, dataset_version_id, revision, source_name,
      geometry_type, geometry, boundary_quality, verification_status, content_hash
    ) VALUES (
      'revision-null-polygon', 'place-country', 'dataset-version-1', 2,
      'Null polygon', 'Polygon', NULL,
      'MISSING', 'PENDING_REVIEW',
      'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    );
    accepted := true;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: typed geometry cannot be NULL';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'NULL typed geometry was accepted';
  END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.place_revision (
      id, place_id, dataset_version_id, revision, source_name,
      geometry_type, geometry, boundary_quality, verification_status, content_hash
    ) VALUES (
      'revision-type-mismatch', 'place-country', 'dataset-version-1', 2,
      'Type mismatch', 'Polygon', ST_SetSRID(ST_MakePoint(3, 6), 4326),
      'APPROXIMATE_BOUNDARY', 'PENDING_REVIEW',
      'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    );
    accepted := true;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS: declared/actual geometry type mismatch rejected';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Geometry type mismatch was accepted';
  END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.dataset_version (
      id, dataset_id, version_key, source_revision, status,
      manifest_checksum, source_metadata
    ) VALUES (
      'dataset-version-orphan', 'missing-dataset', 'v1', 'ci-fixture', 'STAGED',
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      '{}'::jsonb
    );
    accepted := true;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: dataset-version foreign key rejected an orphan';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Orphan dataset version was accepted';
  END IF;
END
$$;

INSERT INTO earth_geo.place (
  id, public_id, canonical_key, parent_id, kind, name, normalized_name,
  iso_alpha2, iso_alpha3, admin_level, source_provider, source_feature_id
) VALUES (
  'place-child', 'geo_ci_child', 'country:ci:admin1:one', 'place-country',
  'ADMIN1', 'Synthetic Region', 'synthetic region', 'XZ', 'XYZ', 1,
  'phase2-ci', 'admin1-one'
);

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    DELETE FROM earth_geo.place WHERE id = 'place-country';
    accepted := true;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: hierarchy parent deletion is restricted';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Parent place with a child was deleted';
  END IF;
END
$$;

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    DELETE FROM earth_geo.dataset WHERE id = 'dataset-fixture';
    accepted := true;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: dataset deletion is restricted while versions exist';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'Dataset with a version was deleted';
  END IF;
END
$$;

INSERT INTO earth_geo.dataset_version (
  id, dataset_id, version_key, source_revision, status,
  manifest_checksum, source_metadata
) VALUES (
  'dataset-version-2', 'dataset-fixture', 'v2', 'ci-fixture-2', 'STAGED',
  'sha256:2222222222222222222222222222222222222222222222222222222222222222',
  '{"synthetic":true}'::jsonb
);

DO $$
DECLARE
  accepted boolean := false;
BEGIN
  BEGIN
    INSERT INTO earth_geo.place_revision (
      id, place_id, dataset_version_id, revision, source_name,
      geometry_type, geometry, boundary_quality, verification_status,
      content_hash, is_current
    ) VALUES (
      'revision-second-current', 'place-country', 'dataset-version-2', 2,
      'Second current revision', 'Polygon',
      ST_GeomFromText('POLYGON((3 6,4 6,4 7,3 6))', 4326),
      'APPROXIMATE_BOUNDARY', 'PENDING_REVIEW',
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      true
    );
    accepted := true;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'PASS: only one current revision is allowed per place';
  END;
  IF accepted THEN
    RAISE EXCEPTION 'A second current revision was accepted';
  END IF;
END
$$;

SELECT 'PASS: valid WGS84 polygon persisted' AS result,
       GeometryType(geometry) AS geometry_type,
       ST_SRID(geometry) AS srid,
       ST_IsValid(geometry) AS is_valid
FROM earth_geo.place_revision
WHERE id = 'revision-valid';

SELECT 'PASS: expected indexes exist' AS result,
       string_agg(indexname, ', ' ORDER BY indexname) AS verified_indexes
FROM pg_indexes
WHERE schemaname = 'earth_geo'
  AND indexname IN (
    'place_parent_kind_name_idx',
    'place_revision_geometry_gist_idx',
    'place_revision_one_current_idx'
  );

\echo 'PASS: all Earth Phase 2 PostGIS checks completed'
