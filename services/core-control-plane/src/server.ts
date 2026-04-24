import http from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  CoreControlPlane,
  InMemoryEventJournal,
  InMemoryIdempotencyStore,
  POSTGRES_EVENT_JOURNAL_DDL,
  type AgentTaskContract,
  type AppendEventInput,
  type CoreCommandContext,
  type DomainEvent,
  type EventMetadata,
  type IdempotencyRecord,
  type SeedIdentityCommand,
  type SupervisorDecision,
  type TransitionRunCommand,
  type CreateRunCommand
} from "@nadovibe/core-kernel";
import { createBuildMetadata } from "@nadovibe/core-operations";

interface DurableCoreStore {
  readonly kind: "postgres" | "file";
  init(): Promise<void>;
  loadEvents(): Promise<readonly DomainEvent[]>;
  loadIdempotencyRecords(): Promise<readonly IdempotencyRecord[]>;
  appendEvents(events: readonly DomainEvent[]): Promise<void>;
  upsertIdempotency(records: readonly IdempotencyRecord[]): Promise<void>;
  commit(events: readonly DomainEvent[], idempotencyRecords: readonly IdempotencyRecord[]): Promise<void>;
  health(): Promise<{ readonly ok: boolean; readonly kind: string; readonly detail: string }>;
}

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

interface IdempotencyRow {
  readonly idempotency_key: string;
  readonly command_name: string;
  readonly request_hash: string;
  readonly result: unknown;
  readonly created_at: Date | string;
}

const port = Number.parseInt(process.env.CORE_CONTROL_PLANE_PORT ?? "8081", 10);
const buildMetadata = createBuildMetadata("core-control-plane");
let runtime: DurableCoreRuntime;

const server = http.createServer(async (request, response) => {
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true, service: "core-control-plane", requestId });
      return;
    }
    if (request.method === "GET" && url.pathname === "/readyz") {
      const storeHealth = await runtime.health();
      sendJson(response, storeHealth.ok ? 200 : 503, {
        ok: storeHealth.ok,
        service: "core-control-plane",
        store: storeHealth,
        eventCount: await runtime.eventCount(),
        requestId
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/version") {
      sendJson(response, 200, { ...buildMetadata, store: runtime.storeKind });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/events") {
      const after = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
      const events = await runtime.readAllEvents();
      const offset = Number.isFinite(after) && after > 0 ? after : 0;
      sendJson(response, 200, { events: events.slice(offset), lastOffset: events.length });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/events/aggregate") {
      const aggregateId = url.searchParams.get("aggregateId");
      if (!aggregateId) throw new Error("aggregateId is required");
      sendJson(response, 200, { events: await runtime.readAggregate(aggregateId) });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/runs/get") {
      const runId = url.searchParams.get("runId");
      if (!runId) throw new Error("runId is required");
      sendJson(response, 200, { run: await runtime.getRun(runId) });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/identity/get") {
      const tenantId = url.searchParams.get("tenantId");
      const userId = url.searchParams.get("userId");
      const workspaceId = url.searchParams.get("workspaceId");
      if (!tenantId || !userId || !workspaceId) throw new Error("tenantId, userId, and workspaceId are required");
      sendJson(response, 200, { seed: await runtime.getIdentitySeed(tenantId, userId, workspaceId) });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/capacity/active") {
      sendJson(response, 200, { reservations: await runtime.activeReservations() });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/core/idempotency") {
      const key = url.searchParams.get("key");
      if (!key) throw new Error("key is required");
      sendJson(response, 200, { record: await runtime.getIdempotency(key) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/idempotency") {
      const body = await readJson(request);
      sendJson(response, 200, { record: await runtime.putIdempotency(requireRecord(body, "record") as unknown as IdempotencyRecord) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/events/append") {
      const body = await readJson(request);
      const input = requireRecord(body, "input") as unknown as AppendEventInput;
      const expected = typeof body.expectedAggregateVersion === "number" ? body.expectedAggregateVersion : undefined;
      sendJson(response, 201, { event: await runtime.appendEvent(input, expected) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/events/append-if-missing") {
      const body = await readJson(request);
      const input = requireRecord(body, "input") as unknown as AppendEventInput;
      sendJson(response, 200, { event: await runtime.appendIfMissing(input) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/identity/seed") {
      const body = await readJson(request);
      sendJson(response, 201, {
        seed: await runtime.seedIdentity(requireRecord(body, "command") as unknown as SeedIdentityCommand, requireRecord(body, "context") as unknown as CoreCommandContext)
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/runs/create") {
      const body = await readJson(request);
      sendJson(response, 201, {
        run: await runtime.createRun(requireRecord(body, "command") as unknown as CreateRunCommand, requireRecord(body, "context") as unknown as CoreCommandContext)
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/runs/transition") {
      const body = await readJson(request);
      sendJson(response, 200, {
        run: await runtime.transitionRun(requireRecord(body, "command") as unknown as TransitionRunCommand, requireRecord(body, "context") as unknown as CoreCommandContext)
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/supervisor/decision") {
      const body = await readJson(request);
      sendJson(response, 201, {
        decision: await runtime.recordSupervisorDecision(requireRecord(body, "decision") as unknown as SupervisorDecision, requireRecord(body, "context") as unknown as CoreCommandContext)
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/runs/complete") {
      const body = await readJson(request);
      const runId = requireString(body, "runId");
      const supervisorDecisionId = typeof body.supervisorDecisionId === "string" ? body.supervisorDecisionId : undefined;
      sendJson(response, 200, { run: await runtime.completeRun(runId, supervisorDecisionId, requireRecord(body, "context") as unknown as CoreCommandContext) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/core/agents/start-work") {
      const body = await readJson(request);
      await runtime.startAgentWork(requireRecord(body, "contract") as unknown as AgentTaskContract, requireRecord(body, "context") as unknown as CoreCommandContext);
      sendJson(response, 202, { ok: true });
      return;
    }
    sendJson(response, 404, { error: "not_found", requestId });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error", requestId });
  }
});

class DurableCoreRuntime {
  private core = new CoreControlPlane();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly store: DurableCoreStore) {}

  get storeKind(): DurableCoreStore["kind"] {
    return this.store.kind;
  }

  async init(): Promise<void> {
    await this.store.init();
    await this.reloadFromStore();
  }

  async health(): Promise<{ readonly ok: boolean; readonly kind: string; readonly detail: string }> {
    return this.store.health();
  }

  async eventCount(): Promise<number> {
    await this.writeChain;
    return this.core.events.readAll().length;
  }

  async readAllEvents(): Promise<readonly DomainEvent[]> {
    await this.writeChain;
    return this.core.events.readAll();
  }

  async readAggregate(aggregateId: string): Promise<readonly DomainEvent[]> {
    await this.writeChain;
    return this.core.events.readAggregate(aggregateId);
  }

  async getRun(runId: string) {
    await this.writeChain;
    return this.core.getRun(runId);
  }

  async getIdentitySeed(tenantId: string, userId: string, workspaceId: string) {
    await this.writeChain;
    return this.core.getIdentitySeed(tenantId, userId, workspaceId);
  }

  async activeReservations() {
    await this.writeChain;
    return this.core.capacity.activeReservations();
  }

  async getIdempotency(key: string): Promise<IdempotencyRecord | undefined> {
    await this.writeChain;
    return this.core.idempotency.get(key);
  }

  async putIdempotency(record: IdempotencyRecord): Promise<IdempotencyRecord> {
    return this.mutate((core) => core.idempotency.put(record));
  }

  async appendEvent(input: AppendEventInput, expectedAggregateVersion?: number): Promise<DomainEvent> {
    return this.mutate((core) => {
      const expected = expectedAggregateVersion ?? core.events.readAggregate(input.aggregateId).at(-1)?.aggregateVersion ?? 0;
      return core.events.append(input, expected);
    });
  }

  async appendIfMissing(input: AppendEventInput): Promise<DomainEvent | undefined> {
    return this.mutate((core) => {
      if (core.events.readAggregate(input.aggregateId).some((event) => event.type === input.type)) {
        return undefined;
      }
      const expected = core.events.readAggregate(input.aggregateId).at(-1)?.aggregateVersion ?? 0;
      return core.events.append(input, expected);
    });
  }

  async seedIdentity(command: SeedIdentityCommand, context: CoreCommandContext) {
    return this.mutate((core) => core.seedIdentity(command, context));
  }

  async createRun(command: CreateRunCommand, context: CoreCommandContext) {
    return this.mutate((core) => core.createRun(command, context));
  }

  async transitionRun(command: TransitionRunCommand, context: CoreCommandContext) {
    return this.mutate((core) => core.transitionRun(command, context));
  }

  async recordSupervisorDecision(decision: SupervisorDecision, context: CoreCommandContext) {
    return this.mutate((core) => core.recordSupervisorDecision(decision, context));
  }

  async completeRun(runId: string, supervisorDecisionId: string | undefined, context: CoreCommandContext) {
    return this.mutate((core) => core.completeRun(runId, supervisorDecisionId, context));
  }

  async startAgentWork(contract: AgentTaskContract, context: CoreCommandContext): Promise<void> {
    await this.mutate((core) => core.startAgentWork(contract, context));
  }

  private async mutate<TResult>(action: (core: CoreControlPlane) => TResult): Promise<TResult> {
    const run = this.writeChain.then(async () => {
      const beforeCount = this.core.events.readAll().length;
      try {
        const result = action(this.core);
        const events = this.core.events.readAll().slice(beforeCount);
        await this.store.commit(events, this.core.idempotency.readAll());
        return result;
      } catch (error) {
        await this.reloadFromStore();
        throw error;
      }
    });
    this.writeChain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async reloadFromStore(): Promise<void> {
    const events = await this.store.loadEvents();
    const idempotency = await this.store.loadIdempotencyRecords();
    this.core = new CoreControlPlane({
      events: new InMemoryEventJournal({ events }),
      idempotency: new InMemoryIdempotencyStore(idempotency)
    });
    this.core.replay(events);
  }
}

class FileCoreStore implements DurableCoreStore {
  readonly kind = "file" as const;
  private readonly eventPath: string;
  private readonly idempotencyPath: string;

  constructor(root: string) {
    this.eventPath = path.join(root, "core-events.jsonl");
    this.idempotencyPath = path.join(root, "core-command-idempotency.json");
  }

  async init(): Promise<void> {
    mkdirSync(path.dirname(this.eventPath), { recursive: true });
    if (!existsSync(this.eventPath)) writeFileSync(this.eventPath, "", "utf8");
    if (!existsSync(this.idempotencyPath)) writeFileSync(this.idempotencyPath, "[]\n", "utf8");
  }

  async loadEvents(): Promise<readonly DomainEvent[]> {
    return readJsonLines<DomainEvent>(this.eventPath);
  }

  async loadIdempotencyRecords(): Promise<readonly IdempotencyRecord[]> {
    return readJsonArray<IdempotencyRecord>(this.idempotencyPath);
  }

  async appendEvents(events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    appendFileSync(this.eventPath, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
  }

  async upsertIdempotency(records: readonly IdempotencyRecord[]): Promise<void> {
    const tmp = `${this.idempotencyPath}.tmp`;
    writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n", "utf8");
    renameSync(tmp, this.idempotencyPath);
  }

  async commit(events: readonly DomainEvent[], idempotencyRecords: readonly IdempotencyRecord[]): Promise<void> {
    await this.appendEvents(events);
    await this.upsertIdempotency(idempotencyRecords);
  }

  async health(): Promise<{ readonly ok: boolean; readonly kind: string; readonly detail: string }> {
    try {
      readFileSync(this.eventPath, "utf8");
      return { ok: true, kind: this.kind, detail: this.eventPath };
    } catch (error) {
      return { ok: false, kind: this.kind, detail: error instanceof Error ? error.message : "file_store_unavailable" };
    }
  }
}

class PostgresCoreStore implements DurableCoreStore {
  readonly kind = "postgres" as const;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: Number.parseInt(process.env.CORE_PG_POOL_MAX ?? "8", 10) });
  }

  async init(): Promise<void> {
    await this.pool.query(POSTGRES_EVENT_JOURNAL_DDL);
  }

  async loadEvents(): Promise<readonly DomainEvent[]> {
    const result = await this.pool.query<CoreEventRow>(
      `SELECT event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata
       FROM core_events
       ORDER BY created_at ASC,
         CASE WHEN event_id ~ '^evt_[0-9]+$' THEN substring(event_id from 5)::bigint ELSE 9223372036854775807 END ASC,
         event_id ASC`
    );
    return result.rows.map((row) => rowToEvent(row));
  }

  async loadIdempotencyRecords(): Promise<readonly IdempotencyRecord[]> {
    const result = await this.pool.query<IdempotencyRow>(
      `SELECT idempotency_key, command_name, request_hash, result, created_at FROM core_command_idempotency ORDER BY created_at ASC`
    );
    return result.rows.map((row) => ({
      key: row.idempotency_key,
      commandName: row.command_name,
      requestHash: row.request_hash,
      result: row.result,
      createdAt: typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString()
    }));
  }

  async appendEvents(events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const event of events) {
        await client.query(
          `INSERT INTO core_events
            (event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata, tenant_id, request_id, causation_id, correlation_id, source_service, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14::timestamptz)`,
          [
            event.id,
            event.aggregateId,
            event.aggregateType,
            event.aggregateVersion,
            event.type,
            event.schemaVersion,
            JSON.stringify(event.payload),
            JSON.stringify(event.metadata),
            event.metadata.tenantId,
            event.metadata.requestId,
            event.metadata.causationId ?? null,
            event.metadata.correlationId,
            event.metadata.sourceService,
            event.metadata.timestamp
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertIdempotency(records: readonly IdempotencyRecord[]): Promise<void> {
    if (records.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const record of records) {
        await client.query(
          `INSERT INTO core_command_idempotency (idempotency_key, command_name, request_hash, result, created_at)
           VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)
           ON CONFLICT (idempotency_key) DO UPDATE
           SET command_name = EXCLUDED.command_name, request_hash = EXCLUDED.request_hash, result = EXCLUDED.result`,
          [record.key, record.commandName, record.requestHash, JSON.stringify(record.result), record.createdAt]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async commit(events: readonly DomainEvent[], idempotencyRecords: readonly IdempotencyRecord[]): Promise<void> {
    if (events.length === 0 && idempotencyRecords.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const event of events) {
        await insertEvent(client, event);
      }
      for (const record of idempotencyRecords) {
        await upsertIdempotencyRecord(client, record);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<{ readonly ok: boolean; readonly kind: string; readonly detail: string }> {
    try {
      await this.pool.query("SELECT 1");
      return { ok: true, kind: this.kind, detail: "postgres reachable" };
    } catch (error) {
      return { ok: false, kind: this.kind, detail: error instanceof Error ? error.message : "postgres_unavailable" };
    }
  }
}

function createStoreFromEnv(): DurableCoreStore {
  const databaseUrl = process.env.DATABASE_URL ?? buildDatabaseUrlFromEnv();
  if (databaseUrl) {
    return new PostgresCoreStore(databaseUrl);
  }
  return new FileCoreStore(process.env.CORE_EVENT_JOURNAL_DIR ?? "/var/lib/nadovibe/event-journal");
}

function buildDatabaseUrlFromEnv(): string | undefined {
  const host = process.env.POSTGRES_HOST;
  if (!host) return undefined;
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "nadovibe";
  const user = process.env.POSTGRES_USER ?? "nadovibe";
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD ?? "");
  return `postgresql://${encodeURIComponent(user)}:${password}@${host}:${port}/${encodeURIComponent(db)}`;
}

function rowToEvent<TPayload = unknown>(row: CoreEventRow): DomainEvent<TPayload> {
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

async function insertEvent(client: PoolClient, event: DomainEvent): Promise<void> {
  await client.query(
    `INSERT INTO core_events
      (event_id, aggregate_id, aggregate_type, aggregate_version, event_type, schema_version, payload, metadata, tenant_id, request_id, causation_id, correlation_id, source_service, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14::timestamptz)`,
    [
      event.id,
      event.aggregateId,
      event.aggregateType,
      event.aggregateVersion,
      event.type,
      event.schemaVersion,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
      event.metadata.tenantId,
      event.metadata.requestId,
      event.metadata.causationId ?? null,
      event.metadata.correlationId,
      event.metadata.sourceService,
      event.metadata.timestamp
    ]
  );
}

async function upsertIdempotencyRecord(client: PoolClient, record: IdempotencyRecord): Promise<void> {
  await client.query(
    `INSERT INTO core_command_idempotency (idempotency_key, command_name, request_hash, result, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)
     ON CONFLICT (idempotency_key) DO UPDATE
     SET command_name = EXCLUDED.command_name, request_hash = EXCLUDED.request_hash, result = EXCLUDED.result`,
    [record.key, record.commandName, record.requestHash, JSON.stringify(record.result), record.createdAt]
  );
}

function readJsonLines<T>(filePath: string): readonly T[] {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function readJsonArray<T>(filePath: string): readonly T[] {
  const text = readFileSync(filePath, "utf8").trim();
  return text ? (JSON.parse(text) as T[]) : [];
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
}

function requireRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${key} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

runtime = new DurableCoreRuntime(createStoreFromEnv());
await runtime.init();

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "core-control-plane listening", port, store: runtime.storeKind }) + "\n");
});
