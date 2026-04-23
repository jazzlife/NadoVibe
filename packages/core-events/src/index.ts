export type ActorType = "user" | "service" | "agent" | "system";

export interface ActorRef {
  readonly type: ActorType;
  readonly id: string;
}

export interface EventMetadata {
  readonly tenantId: string;
  readonly userId?: string;
  readonly requestId: string;
  readonly causationId?: string;
  readonly correlationId: string;
  readonly sourceService: string;
  readonly actor: ActorRef;
  readonly timestamp: string;
}

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly aggregateVersion: number;
  readonly type: string;
  readonly schemaVersion: number;
  readonly payload: TPayload;
  readonly metadata: EventMetadata;
}

export interface AppendEventInput<TPayload = unknown> {
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly type: string;
  readonly schemaVersion: number;
  readonly payload: TPayload;
  readonly metadata: Omit<EventMetadata, "timestamp"> & { readonly timestamp?: string };
}

export interface EventSnapshot<TState = unknown> {
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly aggregateVersion: number;
  readonly state: TState;
  readonly createdAt: string;
}

export interface EventJournal {
  append<TPayload>(input: AppendEventInput<TPayload>, expectedAggregateVersion: number): DomainEvent<TPayload>;
  readAggregate(aggregateId: string): readonly DomainEvent[];
  readAll(): readonly DomainEvent[];
  snapshot<TState>(snapshot: Omit<EventSnapshot<TState>, "createdAt"> & { readonly createdAt?: string }): EventSnapshot<TState>;
  readLatestSnapshot<TState = unknown>(aggregateId: string): EventSnapshot<TState> | undefined;
}

const SECRET_KEY_PATTERN = /(^|[_-])(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|secret|credential|private[_-]?key|authorization)($|[_-])/i;
const SECRET_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/;

export class EventJournalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventJournalError";
  }
}

export class SecretPayloadError extends EventJournalError {
  constructor(path: string) {
    super(`Secret-like data is not allowed in event payload at ${path}`);
    this.name = "SecretPayloadError";
  }
}

export class OptimisticConcurrencyError extends EventJournalError {
  constructor(aggregateId: string, expected: number, actual: number) {
    super(`Aggregate ${aggregateId} expected version ${expected}, actual ${actual}`);
    this.name = "OptimisticConcurrencyError";
  }
}

export function assertNoSecretPayload(value: unknown, path = "$"): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERN.test(value)) {
      throw new SecretPayloadError(path);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretPayload(entry, `${path}[${index}]`));
    return;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const entryPath = `${path}.${key}`;
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new SecretPayloadError(entryPath);
    }
    assertNoSecretPayload(entry, entryPath);
  }
}

export function createEventMetadata(input: Omit<EventMetadata, "timestamp"> & { readonly timestamp?: string }): EventMetadata {
  return {
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString()
  };
}

export class InMemoryEventJournal implements EventJournal {
  private readonly events: DomainEvent[] = [];
  private readonly snapshotsByAggregate = new Map<string, EventSnapshot[]>();
  private nextSequence = 1;

  append<TPayload>(input: AppendEventInput<TPayload>, expectedAggregateVersion: number): DomainEvent<TPayload> {
    assertNoSecretPayload(input.payload);
    const currentVersion = this.readAggregate(input.aggregateId).at(-1)?.aggregateVersion ?? 0;
    if (currentVersion !== expectedAggregateVersion) {
      throw new OptimisticConcurrencyError(input.aggregateId, expectedAggregateVersion, currentVersion);
    }

    const event: DomainEvent<TPayload> = {
      id: `evt_${this.nextSequence++}`,
      aggregateId: input.aggregateId,
      aggregateType: input.aggregateType,
      aggregateVersion: currentVersion + 1,
      type: input.type,
      schemaVersion: input.schemaVersion,
      payload: input.payload,
      metadata: createEventMetadata(input.metadata)
    };
    this.events.push(event);
    return event;
  }

  readAggregate(aggregateId: string): readonly DomainEvent[] {
    return this.events.filter((event) => event.aggregateId === aggregateId);
  }

  readAll(): readonly DomainEvent[] {
    return [...this.events];
  }

  snapshot<TState>(snapshot: Omit<EventSnapshot<TState>, "createdAt"> & { readonly createdAt?: string }): EventSnapshot<TState> {
    assertNoSecretPayload(snapshot.state);
    const created: EventSnapshot<TState> = {
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      aggregateVersion: snapshot.aggregateVersion,
      state: snapshot.state,
      createdAt: snapshot.createdAt ?? new Date().toISOString()
    };
    const snapshots = this.snapshotsByAggregate.get(snapshot.aggregateId) ?? [];
    snapshots.push(created);
    this.snapshotsByAggregate.set(snapshot.aggregateId, snapshots);
    return created;
  }

  readLatestSnapshot<TState = unknown>(aggregateId: string): EventSnapshot<TState> | undefined {
    return this.snapshotsByAggregate.get(aggregateId)?.at(-1) as EventSnapshot<TState> | undefined;
  }
}

export interface IdempotencyRecord<TResult = unknown> {
  readonly key: string;
  readonly commandName: string;
  readonly requestHash: string;
  readonly result: TResult;
  readonly createdAt: string;
}

export class InMemoryIdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  get<TResult>(key: string): IdempotencyRecord<TResult> | undefined {
    return this.records.get(key) as IdempotencyRecord<TResult> | undefined;
  }

  put<TResult>(record: Omit<IdempotencyRecord<TResult>, "createdAt"> & { readonly createdAt?: string }): IdempotencyRecord<TResult> {
    const stored: IdempotencyRecord<TResult> = {
      ...record,
      createdAt: record.createdAt ?? new Date().toISOString()
    };
    this.records.set(record.key, stored);
    return stored;
  }
}

export interface PgQueryResult<TRow> {
  readonly rows: readonly TRow[];
  readonly rowCount?: number | null;
}

export interface PgQueryClient {
  query<TRow = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PgQueryResult<TRow>>;
}

export const POSTGRES_EVENT_JOURNAL_DDL = `
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
`;

interface CoreEventRow {
  readonly event_id: string;
  readonly aggregate_id: string;
  readonly aggregate_type: string;
  readonly aggregate_version: number;
  readonly event_type: string;
  readonly schema_version: number;
  readonly payload: unknown;
  readonly metadata: EventMetadata;
}

interface SnapshotRow {
  readonly aggregate_id: string;
  readonly aggregate_type: string;
  readonly aggregate_version: number;
  readonly state: unknown;
  readonly created_at: Date | string;
}

export class PostgresEventJournalRepository {
  constructor(private readonly client: PgQueryClient) {}

  async migrate(): Promise<void> {
    await this.client.query(POSTGRES_EVENT_JOURNAL_DDL);
  }

  async append<TPayload>(input: AppendEventInput<TPayload>, expectedAggregateVersion: number): Promise<DomainEvent<TPayload>> {
    assertNoSecretPayload(input.payload);
    const metadata = createEventMetadata(input.metadata);
    await this.client.query("BEGIN");
    try {
      await this.client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.aggregateId]);
      const versionResult = await this.client.query<{ readonly version: number | null }>(
        "SELECT MAX(aggregate_version)::int AS version FROM core_events WHERE aggregate_id = $1",
        [input.aggregateId]
      );
      const currentVersion = versionResult.rows[0]?.version ?? 0;
      if (currentVersion !== expectedAggregateVersion) {
        throw new OptimisticConcurrencyError(input.aggregateId, expectedAggregateVersion, currentVersion);
      }
      const aggregateVersion = currentVersion + 1;
      const eventId = `evt_${input.aggregateId}_${aggregateVersion}`;
      const inserted = await this.client.query<CoreEventRow>(
        `INSERT INTO core_events
          (event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata, tenant_id, request_id, causation_id, correlation_id, source_service)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13)
         RETURNING event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata`,
        [
          eventId,
          input.aggregateId,
          input.aggregateType,
          aggregateVersion,
          input.type,
          input.schemaVersion,
          JSON.stringify(input.payload),
          JSON.stringify(metadata),
          metadata.tenantId,
          metadata.requestId,
          metadata.causationId ?? null,
          metadata.correlationId,
          metadata.sourceService
        ]
      );
      await this.client.query("COMMIT");
      return rowToEvent<TPayload>(inserted.rows[0]);
    } catch (error) {
      await this.client.query("ROLLBACK");
      throw error;
    }
  }

  async readAggregate(aggregateId: string): Promise<readonly DomainEvent[]> {
    const result = await this.client.query<CoreEventRow>(
      `SELECT event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata
       FROM core_events WHERE aggregate_id = $1 ORDER BY aggregate_version ASC`,
      [aggregateId]
    );
    return result.rows.map((row) => rowToEvent(row));
  }

  async readAll(): Promise<readonly DomainEvent[]> {
    const result = await this.client.query<CoreEventRow>(
      `SELECT event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata
       FROM core_events ORDER BY created_at ASC, event_id ASC`
    );
    return result.rows.map((row) => rowToEvent(row));
  }

  async snapshot<TState>(snapshot: Omit<EventSnapshot<TState>, "createdAt"> & { readonly createdAt?: string }): Promise<EventSnapshot<TState>> {
    assertNoSecretPayload(snapshot.state);
    const result = await this.client.query<SnapshotRow>(
      `INSERT INTO core_snapshots (aggregate_id, aggregate_type, aggregate_version, state, created_at)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
       ON CONFLICT (aggregate_id, aggregate_version) DO UPDATE SET state = EXCLUDED.state
       RETURNING aggregate_id, aggregate_type, aggregate_version, state, created_at`,
      [snapshot.aggregateId, snapshot.aggregateType, snapshot.aggregateVersion, JSON.stringify(snapshot.state), snapshot.createdAt ?? null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new EventJournalError("Snapshot insert returned no row");
    }
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      aggregateVersion: row.aggregate_version,
      state: row.state as TState,
      createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString()
    };
  }
}

function rowToEvent<TPayload = unknown>(row: CoreEventRow | undefined): DomainEvent<TPayload> {
  if (!row) {
    throw new EventJournalError("Event query returned no row");
  }
  return {
    id: row.event_id,
    aggregateId: row.aggregate_id,
    aggregateType: row.aggregate_type,
    aggregateVersion: row.aggregate_version,
    type: row.event_type,
    schemaVersion: row.schema_version,
    payload: row.payload as TPayload,
    metadata: row.metadata
  };
}
