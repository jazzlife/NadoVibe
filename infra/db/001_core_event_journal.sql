CREATE TABLE IF NOT EXISTS core_events (
  event_id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL,
  tenant_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  causation_id TEXT,
  correlation_id TEXT NOT NULL,
  source_service TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_id, aggregate_version)
);

CREATE INDEX IF NOT EXISTS idx_core_events_tenant_created_at
  ON core_events (tenant_id, created_at, event_id);

CREATE TABLE IF NOT EXISTS core_snapshots (
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (aggregate_id, aggregate_version)
);

CREATE TABLE IF NOT EXISTS core_command_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  command_name TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
