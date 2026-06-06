# Billing + Usage Architecture (Visual)

## Flow Index

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [B1] Upload Lanes -> [B2] Ingest Core -> [B3] Usage Aggregation -> [B6] UI │
│                               ↘ [B4] Promotion                              │
│ [B5] Stripe State feeds [B2]/[B3]/[B6]                                      │
│ [B7] Redis Plane supports [B2]/[B4]                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## [B1] Upload Lanes (SDK)

```text
┌──────────────────────────────┐             ┌──────────────────────────────┐
│         Events Lane          │             │   Screenshots Segment Lane   │
│                              │             │                              │
│ POST /api/ingest/presign     │             │ POST /api/ingest/segment/presign
│ PUT  upload relay URL        │             │ PUT  upload relay URL        │
│ POST /api/ingest/batch/complete           │ POST /api/ingest/segment/complete
└──────────────┬───────────────┘             └──────────────┬───────────────┘
               │                                            │
               └──────────────────────┬─────────────────────┘
                                      ▼
                              [B2] Ingest Core
```

## [B2] Ingest Core (Captured Sessions + Replay Quota Gate)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Ingest Request Processing                           │
│                                                                              │
│  1) Sampling Gate                                                            │
│     project sampleRate / client isSampledIn is evaluated first               │
│       sampled out => no replay quota decision and no replay quota usage      │
│                                                                              │
│  2) Billing Gate                                                             │
│     checkBillingStatus(teamId)                                               │
│       ├─ teams.payment_failed_at ? -> hard block                             │
│       └─ getTeamSessionUsage(teamId) -> replay quota check                   │
│          quota exhausted => analytics accepted, replay disabled              │
│                                                                              │
│  3) Session Upsert                                                           │
│     ensureIngestSession(projectId, sessionId) -> created?                    │
│                                                                              │
│  4) Captured Session Counting (unlimited analytics)                          │
│     if created == true                                                       │
│       -> incrementProjectSessionCount(projectId, teamId,+1)                  │
│          writes project_usage.sessions                                       │
│          quota-exhausted sessions still count here                           │
│                                                                              │
│  5) Replay Quota Counting (single replay increment)                          │
│     when reconciliation reaches a final kept replay decision                 │
│       -> incrementProjectSessionReplayIfNeeded(sessionId)                    │
│          writes project_usage.session_replays                                │
│          sets sessions.replay_quota_counted_at                               │
│          invalidates Redis replay cache and checks usage alerts              │
│     if quota exhausted, sessions.replay_quota_billing_exhausted=true         │
│       and analytics artifacts continue without replay quota usage            │
│                                                                              │
│  6) Artifact Complete                                                        │
│     updates recording_artifacts + session_metrics                            │
│                                                                              │
│  7) Idempotency (retry-safe ingest)                                          │
│     get/set ingest:idempotency:* keys in Redis                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

```text
                 ┌──────────────────────────────┐
                 │  writes project_usage table  │
                 └──────────────┬───────────────┘
                                ▼
                        [B3] Usage Aggregation
```

## [B3] Usage Aggregation (Replay Quota vs Captured Analytics)

```text
┌─────────────────────────────────────┐      ┌──────────────────────────────────┐
│        FREE (Owner Scoped)          │      │         PAID (Team Scoped)       │
│                                     │      │                                  │
│ users.id (owner)                    │      │ teamId                           │
│   -> teams.owner_user_id = owner    │      │   -> teams.stripe_subscription_id│
│      AND no subscription            │      │      exists                      │
│   -> projects in those free teams   │      │   -> projects in that team       │
│   -> SUM(session_replays)           │      │   -> SUM(session_replays)        │
│      for replay quota               │      │      for replay quota            │
│   -> SUM(project_usage.sessions)    │      │   -> SUM(project_usage.sessions) │
│      for unlimited analytics count  │      │      for unlimited analytics     │
│   -> compare replays vs 5000        │      │   -> compare replays vs Stripe   │
│                                     │      │      metadata.session_limit      │
└─────────────────────────────────────┘      └──────────────────────────────────┘
```

`project_usage.sessions` is now captured analytics sessions. It is not a replay
quota ledger and reconciliation may only raise it from `sessions` table ground
truth, never lower preserved usage.

`project_usage.session_replays` is the quota ledger. Billing warnings, SDK
remote config, plan usage, free-tier usage, and quota exhaustion all read this
counter.

Old API fields remain replay aliases:

```text
sessionsUsed      = sessionReplaysUsed
sessionLimit      = sessionReplayLimit
sessionsRemaining = sessionReplaysRemaining
percentUsed       = sessionReplayPercentUsed
```

New API fields expose both concepts:

```text
sessionsCaptured
sessionReplaysUsed
sessionReplayLimit
sessionReplaysRemaining
sessionReplayPercentUsed
```

## [B4] Replay Visibility Branch (Visual Presence + Intent)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         POST /api/ingest/session/end                         │
│                                      │                                       │
│                                      ▼                                       │
│                 Replay visibility no longer mutates at session end           │
│                                      │                                       │
│             Session appears in replay archive iff replay retention is saved  │
│             and retained visual replay data exists. Artifact readiness alone │
│             is not enough: Smart Capture can keep artifacts hidden as        │
│             buffered while a decision is pending.                            │
│                                                                              │
│        Quota-exhausted sessions remain analytics sessions and carry          │
│        sessions.replay_quota_billing_exhausted=true so missing visuals are   │
│        expected, not treated as an upload failure.                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## [B4a] Smart Capture Decision Layer

Smart Capture is server-side and project-level. It does not require changes to
iOS, RN iOS, RN Android, or Web packages.

The intended architecture is:

```text
sessionEvidence.ts
  -> artifact/event readiness, pending event evidence, replay counts
smartCapture.ts
  -> normalize config, evaluate rules, return side-effect-free decision
replayRetention.ts
  -> apply quota/buffer constraints and choose retention state
replayAvailability.ts
  -> derive canOpenReplay for routes/workers
```

The intended order is:

```text
SDK / project gates
  -> SDK master switch / rejourneyEnabled
  -> project recording switch
  -> sampleRate / sampled-out decision
  -> observe-only or no-record configuration

Captured session ingest
  -> session row materializes
  -> analytics/events/metrics are accepted
  -> project_usage.sessions increments as unlimited captured analytics

Replay quota gate
  -> if replay quota is exhausted:
       discard or skip visual replay data
       keep analytics/events/metrics
       sessions.observe_only remains false
       sessions.replay_quota_billing_exhausted = true
       sessions.replay_available = false
       do not increment project_usage.session_replays

Smart Capture config + rules
  -> Scale entitlement comes from Stripe plan metadata smart_capture_enabled=true
  -> project config comes from GET/PUT /api/projects/:id/smart-capture
  -> if disabled or not entitled, effective mode is record_all
  -> dashboard edits live in the Replays page capture modal
  -> if replay quota remains:
       evaluate server-side keep/discard rules
       examples: minimum session duration, rage/dead taps, crashes, ANRs,
                 failed onboarding return, churn/retention outcome, sampled
                 funnels, requested customer predicates
  -> if qualified:
       retain replay artifacts
       sessions.replay_available = true
       sessions.replay_retention_state = saved
       incrementProjectSessionReplayIfNeeded(sessionId)
       project_usage.session_replays += 1 exactly once
  -> if delayed decision is still pending:
       keep replay artifacts in a hidden buffer
       sessions.replay_available = true
       sessions.replay_retention_state = buffered
       sessions.smart_capture_status = pending
       do not increment project_usage.session_replays yet
  -> if not qualified:
       keep analytics/events/metrics
       do not expose replay
       sessions.replay_available = false
       sessions.replay_retention_state = analytics_only
       do not increment project_usage.session_replays
       abandon visual replay artifacts after the decision window
```

Important semantics:

- Canonical replay state column semantics live in
  [`dev_docs/replay-state-columns.md`](./replay-state-columns.md).
- Sampling and explicit observe-only/no-record decisions are first-layer controls.
- Replay quota exhaustion is not observe-only mode; it uses
  `replay_quota_billing_exhausted` as the audit marker.
- Smart Capture runs after hard first-layer gates and replay artifact readiness.
- `replay_available=true` is retained artifact truth: visual replay artifacts
  currently exist and are technically playable. Dashboard replay surfaces still require
  `replay_retention_state=saved`, so buffered Smart Capture replays are hidden.
- `replay_retention_state=buffered` is capped by
  `RJ_SMART_CAPTURE_BUFFER_MAX_REPLAYS`, defaulting to `200000`.
- The deploy migration leaves historical `sessions.replay_retention_state` as
  `NULL` instead of rewriting the hot `sessions` table. `NULL` means legacy row:
  use the old `replay_available`, `recording_deleted`, `is_replay_expired`, and
  quota guards. New app code writes precise states as sessions reconcile, and
  optional cleanup can run later outside the deploy path.
- `replay_quota_counted_at` should normally be set only for retained, available
  replays that count toward replay usage. The exception is pre-cutover sessions
  covered by the preserved legacy ledger; those may be lazily marked counted
  without incrementing usage.
- Some Smart Capture rules are immediate (`duration >= N seconds`, crash, rage
  tap); others are delayed/offline (`failed to return after onboarding`,
  churned later). Delayed rules have a maximum 7-day decision window before
  visual artifacts are saved or purged.
- Rule JSON is normalized before evaluation. Manual rules and AI-created rules
  share the same backend evaluator, including compound `all` clauses and scoped
  metrics such as rage taps on a screen/page.

Implemented schema:

```text
projects.smart_capture_enabled                  boolean
projects.smart_capture_mode                     record_all | smart_capture | analytics_only
projects.smart_capture_preset                   preset key
projects.smart_capture_rules                    jsonb rule list
projects.smart_capture_decision_window_hours    integer

sessions.replay_retention_state                 NULL legacy | saved | buffered | analytics_only | not_available
sessions.smart_capture_status                   not_applicable | pending | kept | discarded
sessions.smart_capture_reason                   min_duration | rage_tap | ...
sessions.smart_capture_rule_id                  matched rule id
sessions.smart_capture_decided_at               timestamp
```

Do not overload `observe_only` for smart capture. Observe-only means the customer
or SDK intentionally requested non-visual analytics. Smart-capture discard means
the session was eligible for replay capture but the server chose not to retain it.

## [B5] Stripe State + Webhooks

```text
┌──────────────┐      ┌──────────────────────────────┐      ┌─────────────────┐
│  Dashboard   │─────▶│  Stripe API / Billing Portal │─────▶│ Stripe Webhooks │
└──────────────┘      └──────────────┬───────────────┘      └────────┬────────┘
                                     │                               │
                                     │ updates teams fields          │ idempotency
                                     ▼                               ▼
                      ┌────────────────────────────────────────────────────┐
                      │ teams:                                              │
                      │ - stripe_subscription_id                            │
                      │ - stripe_price_id                                   │
                      │ - billing_cycle_anchor                              │
                      │ - payment_failed_at                                 │
                      │                                                     │
                      │ stripe_webhook_events: processed event ids          │
                      └────────────────────────────────────────────────────┘
```

These fields affect [B2] gate behavior and [B3] aggregation mode.

## [B6] UI Counters (Why Values Can Differ)

```text
┌─────────────────────────────────────┐      ┌──────────────────────────────────┐
│ Top Bar Project Sessions            │      │ Billing / Account Free Tier      │
│                                     │      │                                  │
│ Source: sessions stats              │      │ Source: aggregated project_usage │
│ (project list / last 7 days)        │      │ (replay quota + captured count)  │
└─────────────────────────────────────┘      └──────────────────────────────────┘
```

Mismatch pattern:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ sessions > 0 but project_usage empty -> Top Bar shows sessions, Billing 0   │
│                                                                              │
│ New ingest flow in [B2] prevents this for new captured sessions.            │
│ Replay usage only rises after a final kept replay decision sets counted_at. │
└──────────────────────────────────────────────────────────────────────────────┘
```

Billing UI should show both:

```text
Session replays recorded: quota progress bar
Sessions captured: unlimited analytics sessions
```

Pricing/public pages should describe plans as `session replays/mo` and include
`Unlimited analytics sessions`.

## [B7] Redis Plane (What It Does In This System)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  Redis                                       │
│                                                                              │
│  A) Replay Limit Cache + Stampede Lock                                       │
│     keys: sessions:{teamId}:{period}                                         │
│           session_lock:{teamId}:{period}                                     │
│     used by getSessionLimitCacheWithLock() in billing gate                   │
│     stores replay aliases plus explicit replay/captured fields               │
│                                                                              │
│  B) Ingest Idempotency                                                       │
│     keys: ingest:idempotency:{projectId}:{idempotencyKey}                    │
│     prevents duplicate counting/processing on retries                        │
│                                                                              │
│  C) Replay Promotion Reason Rate Limits                                      │
│     keys: replay_rate:{projectId}:{reason}:{windowId}                        │
│     limits floods (crash/anr/rage/etc.)                                      │
│                                                                              │
│  D) Upload Token State (short-lived)                                         │
│     keys: upload:token:{projectId}:{deviceId}                                │
│                                                                              │
│  Degradation behavior:                                                       │
│  - if Redis cache/lock fails: fallback to DB path                            │
│  - v1 cache fields sessionsUsed/sessionLimit remain replay aliases           │
│  - if idempotency key is missing/unavailable: less retry dedupe protection   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Schema View (Billing-Relevant)

```text
┌───────────┐      ┌─────────┐      ┌─────────────┐      ┌──────────────┐
│   users   │◀────▶│  teams  │◀────▶│  projects   │◀────▶│ project_usage │
└───────────┘      └─────────┘      └─────────────┘      └──────────────┘
                        │
                        ├────────────▶ billing_usage
                        ├────────────▶ billing_notifications
                        └────────────▶ stripe_webhook_events
```

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Redis keys (runtime plane, not SQL schema):                                 │
│ sessions:*  session_lock:*  ingest:idempotency:*  replay_rate:* upload:token:* │
└──────────────────────────────────────────────────────────────────────────────┘
```

```text
┌───────────┐
│ sessions  │  (analytics/session timeline)
└─────┬─────┘
      ├────────────▶ replay_available (retained artifact truth)
      ├────────────▶ replay_retention_state (saved/buffered/analytics_only/not_available)
      ├────────────▶ smart_capture_status / reason / rule_id / decided_at
      ├────────────▶ replay_quota_billing_exhausted (analytics-only by quota)
      └────────────▶ replay_quota_counted_at (idempotent replay quota count)
```

## Screenshot-Only Session Trace (End-to-End)

```text
SDK screenshots
   -> /api/ingest/segment/presign
   -> ensureIngestSession(created=true)
   -> incrementProjectSessionCount (+1 captured session)
   -> project_usage.sessions updated
   -> /api/ingest/segment/complete
   -> session_metrics.screenshot_segment_count += 1
   -> reconcileSessionState()
   -> sessionEvidence sees ready replay artifacts
   -> replayRetention sets replay_retention_state=saved
   -> replay archive visibility becomes true through canOpenReplay
   -> incrementProjectSessionReplayIfNeeded(sessionId)
   -> project_usage.session_replays += 1
   -> sessions.replay_quota_counted_at set
```

If the replay quota is exhausted before the session materializes, the events
lane still creates/updates the session row, but visual presign routes skip
upload and the row is marked:

```text
sessions.replay_quota_billing_exhausted = true
sessions.replay_available = false
sessions.replay_retention_state = analytics_only
```

`GET /api/sdk/config` represents replay quota exhaustion as
`billingBlocked=false`, `recordingEnabled=false`, and
`replayQuotaBillingExhausted=true`. Existing SDKs therefore continue normal
analytics paths without starting visual replay capture.

These rows are intentionally excluded from replay-availability health metrics,
because no replay was meant to become available.

## Replay Usage Split Migration

Migration `20260601130000_replay_usage_split` adds:

```text
project_usage.session_replays integer default 0 not null
billing_usage.session_replays integer default 0 not null
sessions.replay_quota_counted_at timestamp null
billing_notifications.dedupe_key text null
billing_cutovers row support
```

Backfill rules:

- Copy `project_usage.sessions` into `project_usage.session_replays` when the new column is still zero.
- Copy `billing_usage.sessions` into `billing_usage.session_replays` when the new column is still zero.
- Do not bulk-update or index the hot `sessions` table in the deploy migration.
- Do not insert the `billing_cutovers('replay_usage_split')` row in the deploy migration. Runtime replay usage increments remain paused until production SSH finalizes the cutover.
- Backfill does not call alert sending and does not lower any existing current-period usage.
- Existing `warning_80` and `limit_100` notifications get a canonical dedupe key where possible; duplicate historical rows are left alone and only the oldest row becomes the keyed record.

Production cutover finalization:

```sql
BEGIN;

UPDATE project_usage
SET session_replays = GREATEST(session_replays, sessions)
WHERE session_replays < sessions;

UPDATE billing_usage
SET session_replays = GREATEST(session_replays, sessions)
WHERE session_replays < sessions;

INSERT INTO billing_cutovers (name, cutover_at)
VALUES ('replay_usage_split', NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;
```

This final SSH step is intentionally small and only touches usage ledger tables
plus one cutover row. It catches up any sessions created while the old app was
still running during deploy. After the cutover row exists, sessions that started
before `cutover_at` are treated as covered by the preserved ledger and may be
lazily marked `replay_quota_counted_at` without incrementing replay usage.
Sessions that start after `cutover_at` increment `project_usage.session_replays`
once when they first become `replay_retention_state=saved`.

Stripe metadata stays backward compatible. Active prices may keep `session_limit`;
that key now means monthly session replay limit. Add `session_replay_limit` only
after every active price carries both keys and all runtime consumers have been
migrated.

## Warning Behavior

Billing warnings still use the existing alert types:

```text
warning_80
limit_100
```

The trigger is session replay usage, not captured analytics sessions. Alerts are
checked only after `project_usage.session_replays` increments. Migration/backfill
must never send warning emails.

Email and dashboard copy should say "session replay usage" and "session replays
remaining." Notification metadata keeps old aliases (`sessionsUsed`,
`sessionLimit`) and adds explicit replay fields (`sessionReplaysUsed`,
`sessionReplayLimit`, `sessionsCaptured`, `usageMetric=session_replays`).

## No Package Change Guarantee

This split is server/dashboard/docs only. No iOS, RN iOS, RN Android, or Web
package change is required.

Existing packages already rely on server config and ingest responses:

- Sampling remains the top layer. If a session is sampled out, there is no replay upload and no replay quota usage.
- Replay quota exhaustion is returned server-side as `recordingEnabled=false`, `billingBlocked=false`, and `replayQuotaBillingExhausted=true`.
- Analytics/events are still accepted server-side even when replay quota is exhausted.
- Stale visual uploads for quota-exhausted sessions are skipped/ignored by ingest and the row is marked `replay_quota_billing_exhausted=true`.

## Grafana / Replay Availability

Replay-availability dashboards must count only sessions that were meant to become
available:

```sql
observe_only = false
AND replay_quota_billing_exhausted = false
AND COALESCE(replay_retention_state, 'saved') = 'saved'
```

Quota-exhausted analytics-only rows are excluded because their missing
screenshots/rrweb are expected billing behavior, not upload failure.

## Production Rollout

1. Run local tests and type checks for backend/dashboard billing paths.
2. Push/merge only after local verification passes.
3. Wait for CI to go green.
4. Let CI apply the Smart Capture migration. It only adds columns and does not
   update every `sessions` row or build blocking session indexes.
5. Build Smart Capture session indexes out of band from a non-transactional SQL
   client:
   - `backend/drizzle/manual/smart-capture-session-indexes-concurrent.sql`
6. After production SSH is provided, finalize the replay usage cutover:
   - confirm the Drizzle migration applied.
   - raise `project_usage.session_replays` and `billing_usage.session_replays` with `GREATEST(session_replays, sessions)`.
   - insert `billing_cutovers('replay_usage_split')`.
   - optionally run a later low-priority batched `sessions.replay_quota_counted_at` historical marker backfill.
7. Verify in production:
   - no existing current-period replay usage was reset or lowered.
   - replay quota checks use `project_usage.session_replays`.
   - captured sessions continue beyond replay quota.
   - warning notifications still work and do not duplicate old-period warnings.
   - dashboard/API show both replay and captured counters.
   - Grafana replay-availability panels exclude `replay_quota_billing_exhausted` sessions.

## Legacy Billing Compatibility Cleanup

Do not do these in the replay split deploy. Track them for later cleanup:

- Remove old API aliases (`sessionsUsed`, `sessionLimit`, `sessionsRemaining`, `percentUsed`) after at least two billing cycles and after all dashboard/API consumers use explicit replay fields.
- Optionally rename Stripe metadata to `session_replay_limit` only after active prices carry both `session_limit` and `session_replay_limit`.
- Remove v1 Redis cache fallback after one deploy plus the full cache TTL.
- Keep `project_usage.sessions` permanently as captured analytics sessions.
- Keep old billing notification types (`warning_80`, `limit_100`) unless historical notification rows are migrated.
- Keep `billing_cutovers('replay_usage_split')` permanently unless replay usage history is rebuilt from a separate audited source.
- Keep `sessions.replay_quota_billing_exhausted` as the audit marker for analytics-only sessions caused by replay quota exhaustion.
