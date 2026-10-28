# SIMVERSE Earth - staged PostgreSQL/PostGIS migration plan

## 1. Goal and boundary

SIMVERSE currently uses SQLite through Prisma and the better-sqlite3 adapter.
Phase 2 keeps that application and its data intact. The PostGIS files under
`infrastructure/earth-postgis/` are an isolated, reversible proof for future
native spatial storage; they are not a production cutover or a second live
application database.

The repository currently has no committed Prisma migration history. Local and
test schemas intentionally use `prisma db push`. This plan does not invent a
partial migration convention. A PostgreSQL migration baseline must be designed,
reviewed and rehearsed as its own gate before any production switch.

## 2. Target foundation

- PostgreSQL 17 and PostGIS 3.6, subject to revalidation at the migration gate;
- one application database initially, with an `earth_geo` schema for native
  geography tables;
- WGS84 (`EPSG:4326`) for global source identity;
- reviewed local metric projections for future Development Zone and parcel
  calculations;
- immutable dataset versions and place revisions;
- native geometry validity constraints and GiST indexes;
- stable storage explicitly approved by the owner. The unstable D: volume is
  excluded.

## 3. Migration stages

### Stage 0 - prerequisites and inventory

Status: **In Progress**.

1. Restore access to a stable PostgreSQL/PostGIS runtime or install Docker on an
   approved stable volume.
2. Revalidate the pinned database/image versions and their support windows.
3. Inventory every SQLite table, relation, row count, nullability rule, unique
   constraint and application query path.
4. Record the SQLite database checksum and create a tested, read-only backup.
5. Define recovery time, acceptable maintenance window and named cutover owner.

No write or destructive action occurs in this stage.

### Stage 1 - execute the isolated spatial proof

Status: **Implemented but Unverified**.

1. Copy `.env.example` to ignored `.env` and set local-only credentials.
2. Start `infrastructure/earth-postgis/compose.yaml`.
3. Verify `PostGIS_Full_Version()`.
4. Run positive and negative geometry inserts to prove SRID, type and
   `ST_IsValid` constraints.
5. inspect the GiST query plan with `EXPLAIN (ANALYZE, BUFFERS)` on a realistic
   data volume.
6. stop and recreate the environment to prove deterministic initialization.

The current machine lacks Docker and `psql`, so these commands have not run.
Repository tests verify the SQL contract only.

### Stage 2 - create the PostgreSQL application schema

Status: **Not Started**.

1. Branch from a clean reviewed checkpoint.
2. change the Prisma provider/adapter only in that migration branch;
3. establish a reviewed PostgreSQL migration baseline for every existing model;
4. represent spatial fields through the reviewed Prisma/native-SQL boundary;
5. preserve all existing IDs, timestamps, foreign keys and unique constraints;
6. run the full application suite against a disposable PostgreSQL database.

Do not mix a provider cutover with parcel, acquisition or other Earth features.

### Stage 3 - deterministic copy and shadow verification

Status: **Not Started**.

1. Quiesce a copy of SQLite, never the only source database.
2. copy tables in foreign-key-safe order using a versioned import tool;
3. convert Earth GeoJSON with `ST_GeomFromGeoJSON`, explicitly setting SRID 4326;
4. compare row counts, IDs, relation counts and deterministic hashes;
5. verify every geometry with `ST_IsValid`, `ST_SRID = 4326` and expected type;
6. compare Nigeria/Lagos hierarchy and boundary results between stores;
7. run all unit, integration, build and manual critical-path checks;
8. retain machine-readable verification output for review.

Any mismatch aborts the rehearsal. The source SQLite copy remains unchanged.

### Stage 4 - application shadow reads

Status: **Not Started**.

1. keep SQLite authoritative;
2. replay/import committed source versions into PostgreSQL;
3. compare allowlisted geography reads in background or offline verification;
4. measure correctness, latency, query plans and geometry payload limits;
5. fix drift through a new versioned import, never by rewriting history.

Dual writes are excluded unless a later design proves idempotency and recovery.

### Stage 5 - rehearsed cutover

Status: **Not Started**.

1. announce a bounded maintenance window;
2. stop application writes and take a final verified SQLite backup;
3. perform the deterministic copy and verification;
4. point a staged application deployment at PostgreSQL;
5. run authentication, workspace isolation, Assets, Worlds, Simulations, Runs,
   Products, Creator/Media and Earth smoke tests;
6. release only after the named owner accepts the evidence;
7. retain SQLite read-only for the approved rollback period.

### Stage 6 - rollback and closure

Status: **Not Started**.

Rollback triggers include verification drift, failed critical paths, unexpected
latency, invalid geometry, authorization regression or data-loss evidence.
Rollback restores the prior application version and original read-only SQLite
database. PostgreSQL is retained for diagnosis; it is not copied back over the
source. A later attempt starts from a fresh snapshot.

After a stable observation period, record final counts/hashes and archive the
SQLite backup according to the approved retention policy.

## 4. Acceptance evidence required before cutover

- PostgreSQL/PostGIS versions and storage location approved;
- full schema and data-copy scripts reviewed and versioned;
- two successful disposable rehearsals from the same SQLite snapshot;
- exact row/relationship/hash parity for existing application data;
- 100% valid expected-SRID Earth geometry;
- representative GiST queries use bounded index-backed plans;
- full automated suite, typecheck, lint and production build pass on PostgreSQL;
- workspace isolation and safe NotFound behavior pass;
- immutable SimulationRun snapshots and Runtime Protocol fixtures remain exact;
- backup restore and rollback time are measured;
- no use of the unstable D: drive;
- explicit owner approval for the maintenance window and cutover.

Until every gate passes, SQLite remains the application datasource and PostGIS
remains a prepared future foundation.
