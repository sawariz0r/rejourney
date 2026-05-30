# Legacy Things to Clean Up

Items that are safe to leave in place for now but should be removed in a future maintenance window.

---

## 1. MP4 support from ingest & API

MP4 upload is not currently wired up end-to-end — only screenshot mode is supported. The ingest routes and API stubs for MP4 exist but are unused. Clean up once the feature is either committed to or permanently dropped.

---

## 2. Stale `ingest_jobs` references after BullMQ migration

**Background:** Artifact job dispatch was migrated from a Postgres poll loop (`ingest_jobs` table) to BullMQ Redis queues (`rj-artifact-flush`, `rj-ingest-artifacts`, `rj-replay-artifacts`). The table drop is already done by migration `20260503000000_drop_ingest_jobs`, and current application schema exports no longer include `ingestJobs`.

**Current gap:** a few non-historical helpers still mention `ingest_jobs` and should be removed or rewritten so they do not assume the old table exists:

- `scripts/k8s/prune-empty-session-backups.mjs`
- `k8s/exporters.yaml`
- `scripts/k8s/gen-grafana-dashboards.py`
- generated `k8s/grafana-dashboards.yaml`

**To clean up:** replace old Postgres job-count checks with BullMQ queue counts or remove the obsolete metrics entirely. The session-backup pruning helper should rely on `recording_artifacts` and session state only.

Do not remove `backend/src/worker/workerDefinitions.ts` or `backend/src/worker/startArtifactWorker.ts`; those files are still the active BullMQ worker definitions and starter.

---

## 3. `api_endpoint_daily_stats` compatibility shell

**Background:** API endpoint analytics moved to ClickHouse raw facts plus `api_endpoint_daily_rollups` in May 2026. The heavy Postgres `api_endpoint_daily_stats` data table was dropped by migration `20260522010000_drop_api_endpoint_daily_stats`, then recreated as an empty no-op compatibility shell so old rolling pods or old tools do not crash on `INSERT ... ON CONFLICT`.

**Current state:**
- Runtime API endpoint reads use ClickHouse, not Postgres.
- Runtime artifact processing no longer writes this Postgres table.
- The table should stay empty; a trigger returns `NULL` for legacy inserts/updates.

**To drop later:** after enough deploys that no old pod/image/tooling expects the relation name, remove any remaining schema references and write a migration:

```sql
DROP TRIGGER IF EXISTS skip_api_endpoint_daily_stats_writes ON public.api_endpoint_daily_stats;
DROP FUNCTION IF EXISTS public.skip_api_endpoint_daily_stats_writes();
DROP TABLE IF EXISTS public.api_endpoint_daily_stats;
```

---

## 4. Derived screenshot frame objects under root `sessions/`

**Background:** Screenshot replay prewarming/materialization writes derived JPEG frame cache objects to:

```text
sessions/{sessionId}/frames/{timestamp}.jpg
```

These objects are useful for fast replay opens because the API can return direct signed JPEG URLs instead of repeatedly unpacking screenshot archives from the canonical tenant path. They are derived cache objects, not canonical recording artifacts.

**Current gap:** routine session retention purges canonical storage under:

```text
tenant/{teamId}/project/{projectId}/sessions/{sessionId}/
```

but should also delete derived root-frame objects for the same session. Project hard-delete already deletes `sessions/{sessionId}/`, but normal retention should not leave derived frame caches behind.

TODO: xplicitly delete `sessions/{sessionId}/` in the session retention purge path after canonical artifact deletion succeeds.

Until this is fixed, do not treat root `sessions/{sessionId}/frames/` as source-of-truth storage. It can be rebuilt from canonical screenshot artifacts while those artifacts still exist.
