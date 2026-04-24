import http from "node:http";
import {
  assertPublicResponseSafe,
  mapCommandIntentToResourceClass,
  mapInternalRunStateToUserStatus,
  parseApprovalDecisionRequest,
  parseConflictEscalationRequest,
  parseCreateRunRequest,
  parseDevIdentitySeedRequest,
  parseEditorSessionRequest,
  parseEnqueueCommandRequest,
  parseFinalReviewDecisionRequest,
  parseHunkDecisionRequest,
  parseMobilePushRegistrationRequest,
  parseNotificationReadRequest,
  parseNotificationSettingsRequest,
  parseSupervisorControlRequest,
  parseWorkspaceFileWriteRequest,
  parseWorkspaceSearchRequest,
  publicProjection,
  rebuildMobileCommandReviewProjection,
  rebuildControlRoomProjection,
  replayStreamFromOffset
} from "@nadovibe/api-contract";
import type {
  ApprovalDecisionRequest,
  CommandQueueItem,
  ConflictEscalationRequest,
  ControlRoomProjectionResponse,
  CreateRunRequest,
  DevIdentitySeedRequest,
  DiffFileItem,
  EditorSessionProjection,
  EditorSessionRequest,
  EnqueueCommandRequest,
  FileTreeItem,
  FinalReviewDecisionRequest,
  HunkDecisionRequest,
  MobilePushRegistrationRequest,
  NotificationReadRequest,
  NotificationSettingsRequest,
  SupervisorControlRequest,
  WorkspaceFileReadResponse,
  WorkspaceFileWriteRequest,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse
} from "@nadovibe/api-contract";
import {
  RUN_TRANSITIONS,
  type AgentTaskContract,
  type AppendEventInput,
  type CapacityReservation,
  type CoreCommandContext,
  type DomainEvent,
  type IdentitySeedRecord,
  type IdempotencyRecord,
  type RunRecord,
  type RunState,
  type SeedIdentityCommand,
  type SupervisorDecision,
  type CreateRunCommand
} from "@nadovibe/core-kernel";
import { buildOperationalAdminSnapshot, createBuildMetadata } from "@nadovibe/core-operations";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

class CoreControlPlaneClient {
  constructor(private readonly baseUrl: string) {}

  async readAll(): Promise<readonly DomainEvent[]> {
    return (await this.request<{ readonly events: readonly DomainEvent[] }>("GET", "/v1/core/events")).events;
  }

  async readAggregate(aggregateId: string): Promise<readonly DomainEvent[]> {
    return (await this.request<{ readonly events: readonly DomainEvent[] }>("GET", `/v1/core/events/aggregate?aggregateId=${encodeURIComponent(aggregateId)}`)).events;
  }

  async append(input: AppendEventInput, expectedAggregateVersion?: number): Promise<DomainEvent> {
    return (await this.request<{ readonly event: DomainEvent }>("POST", "/v1/core/events/append", { input, expectedAggregateVersion })).event;
  }

  async appendIfMissing(input: AppendEventInput): Promise<DomainEvent | undefined> {
    return (await this.request<{ readonly event?: DomainEvent }>("POST", "/v1/core/events/append-if-missing", { input })).event;
  }

  async seedIdentity(command: SeedIdentityCommand, context: CoreCommandContext): Promise<IdentitySeedRecord> {
    return (await this.request<{ readonly seed: IdentitySeedRecord }>("POST", "/v1/core/identity/seed", { command, context })).seed;
  }

  async createRun(command: CreateRunCommand, context: CoreCommandContext): Promise<RunRecord> {
    return (await this.request<{ readonly run: RunRecord }>("POST", "/v1/core/runs/create", { command, context })).run;
  }

  async transitionRun(command: { readonly runId: string; readonly to: RunState }, context: CoreCommandContext): Promise<RunRecord> {
    return (await this.request<{ readonly run: RunRecord }>("POST", "/v1/core/runs/transition", { command, context })).run;
  }

  async recordSupervisorDecision(decision: SupervisorDecision, context: CoreCommandContext): Promise<SupervisorDecision> {
    return (await this.request<{ readonly decision: SupervisorDecision }>("POST", "/v1/core/supervisor/decision", { decision, context })).decision;
  }

  async completeRun(runId: string, supervisorDecisionId: string | undefined, context: CoreCommandContext): Promise<RunRecord> {
    return (await this.request<{ readonly run: RunRecord }>("POST", "/v1/core/runs/complete", { runId, supervisorDecisionId, context })).run;
  }

  async startAgentWork(contract: AgentTaskContract, context: CoreCommandContext): Promise<void> {
    await this.request("POST", "/v1/core/agents/start-work", { contract, context });
  }

  async getRun(runId: string): Promise<RunRecord | undefined> {
    return (await this.request<{ readonly run?: RunRecord }>("GET", `/v1/core/runs/get?runId=${encodeURIComponent(runId)}`)).run;
  }

  async getIdentitySeed(tenantId: string, userId: string, workspaceId: string): Promise<IdentitySeedRecord | undefined> {
    return (await this.request<{ readonly seed?: IdentitySeedRecord }>(
      "GET",
      `/v1/core/identity/get?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&workspaceId=${encodeURIComponent(workspaceId)}`
    )).seed;
  }

  async activeReservations(): Promise<readonly CapacityReservation[]> {
    return (await this.request<{ readonly reservations: readonly CapacityReservation[] }>("GET", "/v1/core/capacity/active")).reservations;
  }

  async getIdempotency<TResult>(key: string): Promise<IdempotencyRecord<TResult> | undefined> {
    return (await this.request<{ readonly record?: IdempotencyRecord<TResult> }>("GET", `/v1/core/idempotency?key=${encodeURIComponent(key)}`)).record;
  }

  async putIdempotency<TResult>(record: Omit<IdempotencyRecord<TResult>, "createdAt"> & { readonly createdAt?: string }): Promise<IdempotencyRecord<TResult>> {
    return (await this.request<{ readonly record: IdempotencyRecord<TResult> }>("POST", "/v1/core/idempotency", { record })).record;
  }

  private async request<TResponse>(method: string, pathToRequest: string, body?: unknown): Promise<TResponse> {
    const init: RequestInit = {
      method,
      headers: { "content-type": "application/json" }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${this.baseUrl}${pathToRequest}`, init);
    const payload = (await response.json()) as TResponse | { readonly error?: string };
    if (!response.ok) {
      throw new Error(typeof (payload as { readonly error?: unknown }).error === "string" ? (payload as { readonly error: string }).error : "core request failed");
    }
    return payload as TResponse;
  }
}

class WorkspaceRuntimeClient {
  constructor(private readonly baseUrl: string) {}

  async readFileTree(workspaceId: string, pathToRead: string): Promise<{ readonly workspaceId: string; readonly items: readonly FileTreeItem[] }> {
    return this.request("GET", `/v1/workspace/files/tree?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(pathToRead)}`);
  }

  async readFile(workspaceId: string, pathToRead: string): Promise<WorkspaceFileReadResponse> {
    return this.request("GET", `/v1/workspace/files/read?workspaceId=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(pathToRead)}`);
  }

  async search(request: WorkspaceSearchRequest): Promise<WorkspaceSearchResponse> {
    return this.request(
      "GET",
      `/v1/workspace/search?workspaceId=${encodeURIComponent(request.workspaceId)}&query=${encodeURIComponent(request.query)}&path=${encodeURIComponent(request.path ?? "")}`
    );
  }

  async writeFile(request: WorkspaceFileWriteRequest): Promise<{ readonly ok: boolean; readonly workspaceId: string; readonly path: string; readonly bytes: number }> {
    return this.request("POST", "/v1/workspace/files/write", request);
  }

  private async request<TResponse>(method: string, pathToRequest: string, body?: unknown): Promise<TResponse> {
    const init: RequestInit = {
      method,
      headers: { "content-type": "application/json" }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${this.baseUrl}${pathToRequest}`, init);
    const payload = (await response.json()) as TResponse | { readonly error?: string };
    if (!response.ok) {
      throw new Error(
        typeof (payload as { readonly error?: unknown }).error === "string" ? (payload as { readonly error: string }).error : "workspace runtime request failed"
      );
    }
    return payload as TResponse;
  }
}

const port = Number.parseInt(process.env.GATEWAY_PORT ?? "8080", 10);
const buildMetadata = createBuildMetadata("gateway");
const coreControlPlaneUrl = (process.env.CORE_CONTROL_PLANE_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");
const workspaceRuntimeUrl = (process.env.WORKSPACE_RUNTIME_URL ?? "http://127.0.0.1:8093").replace(/\/$/, "");
const core = new CoreControlPlaneClient(coreControlPlaneUrl);
const workspaceRuntime = new WorkspaceRuntimeClient(workspaceRuntimeUrl);
const defaultIdentity = {
  tenantId: "tenant_dev",
  userId: "user_dev",
  workspaceId: "workspace_dev",
  repositoryId: "repo_nadovibe"
} as const;

const server = http.createServer(async (request, response) => {
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  try {
    if (request.method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }
    if (request.url === "/healthz") {
      sendJson(response, 200, { ok: true, service: "gateway", requestId });
      return;
    }
    if (request.method === "GET" && request.url === "/version") {
      sendJson(response, 200, buildMetadata);
      return;
    }
    if (request.url === "/readyz") {
      const [coreReady, workspaceReady] = await Promise.all([readDependencyHealth(`${coreControlPlaneUrl}/readyz`), readDependencyHealth(`${workspaceRuntimeUrl}/readyz`)]);
      const ok = coreReady.ok && workspaceReady.ok;
      const eventCount = coreReady.ok ? (await core.readAll()).length : 0;
      sendJson(response, ok ? 200 : 503, {
        ok,
        service: "gateway",
        dependencies: ["core-control-plane", "workspace-runtime"],
        core: coreReady,
        workspaceRuntime: workspaceReady,
        eventCount,
        requestId
      });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/control-room")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const role = url.searchParams.get("role") === "operator" ? "operator" : "user";
      sendJson(response, 200, await projection(role));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/dev/seed") {
      const body = parseDevIdentitySeedRequest(await readJson(request));
      const seed = await seedIdentity(body, requestId);
      sendJson(response, 201, { seed });
      return;
    }
    if (request.method === "POST" && request.url === "/api/dev/seed") {
      const body = parseDevIdentitySeedRequest(await readJson(request));
      const seed = await seedIdentity(body, requestId);
      sendJson(response, 201, { seed });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const run = await createRun(body, requestId);
      sendJson(response, 201, { run });
      return;
    }
    if (request.method === "POST" && request.url === "/api/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const run = await createRun(body, requestId);
      const payload = { runId: run.id, status: mapInternalRunStateToUserStatus(run.state), requestId, projection: await projection("user") };
      assertPublicResponseSafe(payload);
      sendJson(response, 202, payload);
      return;
    }
    if (request.method === "POST" && request.url === "/api/commands") {
      const body = parseEnqueueCommandRequest(await readJson(request));
      sendJson(response, 202, await enqueueCommand(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/approvals/decision") {
      const body = parseApprovalDecisionRequest(await readJson(request));
      sendJson(response, 202, await decideApproval(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/supervisor/control") {
      const body = parseSupervisorControlRequest(await readJson(request));
      sendJson(response, 202, await controlSupervisor(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/conflicts/escalate") {
      const body = parseConflictEscalationRequest(await readJson(request));
      sendJson(response, 202, await escalateConflict(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/editor-session") {
      const body = parseEditorSessionRequest(await readJson(request));
      sendJson(response, 202, await changeEditorSession(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/final-review") {
      const body = parseFinalReviewDecisionRequest(await readJson(request));
      sendJson(response, 202, await decideFinalReview(body, requestId));
      return;
    }
    if (request.method === "GET" && request.url === "/api/projections") {
      const projection = publicProjection(rebuildPlatformReadModels(await core.readAll()));
      assertPublicResponseSafe(projection);
      sendJson(response, 200, projection);
      return;
    }
    if (request.method === "GET" && request.url === "/api/admin/capacity") {
      const readModels = rebuildPlatformReadModels(await core.readAll());
      sendJson(response, 200, { ...readModels.resources, queueDepth: 0 });
      return;
    }
    if (request.method === "GET" && request.url === "/api/admin/operations") {
      sendJson(response, 200, buildOperationalAdminSnapshot({
        services: ["core-control-plane", "app-server-adapter", "orchestrator", "workspace-runtime", "projection-worker", "gateway", "web"],
        reservations: await core.activeReservations(),
        projectionLagEvents: 0,
        queueLagMs: 0
      }));
      return;
    }
    if (request.method === "GET" && request.url === "/api/mobile/review") {
      sendJson(response, 200, await mobileProjection());
      return;
    }
    if (request.method === "POST" && request.url === "/api/mobile/push/register") {
      const body = parseMobilePushRegistrationRequest(await readJson(request));
      sendJson(response, 202, await registerMobilePush(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/mobile/notification-settings") {
      const body = parseNotificationSettingsRequest(await readJson(request));
      sendJson(response, 202, await updateNotificationSettings(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/mobile/notifications/read") {
      const body = parseNotificationReadRequest(await readJson(request));
      sendJson(response, 202, await markNotificationRead(body, requestId));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/files/tree")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const workspaceId = url.searchParams.get("workspaceId") ?? defaultIdentity.workspaceId;
      const requestedPath = url.searchParams.get("path") ?? "";
      sendJson(response, 200, await workspaceRuntime.readFileTree(workspaceId, requestedPath));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/files/read")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const requestedPath = url.searchParams.get("path") ?? "";
      const workspaceId = url.searchParams.get("workspaceId") ?? defaultIdentity.workspaceId;
      sendJson(response, 200, await workspaceRuntime.readFile(workspaceId, requestedPath));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/search")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const body = parseWorkspaceSearchRequest({
        workspaceId: url.searchParams.get("workspaceId") ?? defaultIdentity.workspaceId,
        query: url.searchParams.get("query") ?? "",
        path: url.searchParams.get("path") ?? ""
      });
      sendJson(response, 200, await workspaceRuntime.search(body));
      return;
    }
    if (request.method === "POST" && request.url === "/api/workspace/files/write") {
      const body = parseWorkspaceFileWriteRequest(await readJson(request));
      await workspaceRuntime.writeFile(body);
      await appendEvent("file_write_" + sanitizeId(body.path), "WorkspaceFile", "WorkspaceFileWritten", {
        workspaceId: body.workspaceId,
        path: body.path,
        runId: await latestRunId(),
        message: "파일 저장 완료"
      }, contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId));
      await appendEvent("diff_write_" + sanitizeId(body.path), "Diff", "DiffUpdated", {
        path: body.path,
        additions: Math.max(1, body.content.split("\n").length),
        deletions: 0,
        hunks: [
          {
            hunkId: `hunk_saved_${sanitizeId(body.path)}`,
            title: "Tablet Workbench saved changes",
            additions: Math.max(1, Math.min(40, body.content.split("\n").length)),
            deletions: 0,
            state: "pending"
          }
        ]
      } satisfies DiffFileItem, contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId));
      sendJson(response, 202, await projection("user"));
      return;
    }
    if (request.method === "POST" && request.url === "/api/diff/hunks/decision") {
      const body = parseHunkDecisionRequest(await readJson(request));
      sendJson(response, 202, await decideHunk(body, requestId));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/stream")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const after = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
      const frames = replayStreamFromOffset(await core.readAll(), Number.isFinite(after) ? after : 0);
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "access-control-allow-origin": "*"
      });
      for (const frame of frames) {
        response.write(`id: ${frame.offset}\n`);
        response.write(`event: core_event\n`);
        response.write(`data: ${JSON.stringify(frame.event)}\n\n`);
      }
      response.write(`: stream-open\n\n`);
      const heartbeat = setInterval(() => {
        response.write(`: heartbeat ${Date.now()}\n\n`);
      }, 10000);
      request.on("close", () => clearInterval(heartbeat));
      return;
    }
    sendJson(response, 404, { error: "not_found", requestId });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error", requestId });
  }
});

server.listen(port, "0.0.0.0", () => {
  log("info", "gateway listening", { port });
});

function contextFromSeed(tenantId: string, userId: string, requestId: string): CoreCommandContext {
  return {
    tenantId,
    userId,
    requestId,
    correlationId: requestId,
    sourceService: "gateway",
    actor: { type: "user", id: userId }
  };
}

async function seedIdentity(body: DevIdentitySeedRequest, requestId: string) {
  const context = contextFromSeed(body.tenantId, body.userId, requestId);
  const seed = await core.seedIdentity({ ...body, idempotencyKey: `seed:${body.tenantId}:${body.userId}:${body.workspaceId}`, membershipRole: "owner" }, context);
  await appendIfMissing(body.workspaceId, "Workspace", "WorkspaceCatalogSeeded", {
    workspaceId: body.workspaceId,
    workspaceName: "NadoVibe Platform",
    repositoryId: body.repositoryId,
    repositoryName: "NadoVibe",
    branch: "main"
  }, context);
  await appendIfMissing(`workspace_status_${body.workspaceId}`, "WorkspaceRuntime", "WorkspaceRuntimeStateChanged", {
    workspaceId: body.workspaceId,
    to: "ready"
  }, context);
  log("info", "seeded identity through Core command API", { requestId, tenantId: seed.tenantId, workspaceId: seed.workspaceId });
  return seed;
}

async function createRun(body: CreateRunRequest, requestId: string) {
  const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
  await ensureDefaultSeed(requestId);
  const run = await core.createRun(body, context);
  await appendEvent(`run_objective_${run.id}`, "RunProjection", "RunObjectiveUpdated", {
    runId: run.id,
    objective: body.objective ?? "새 멀티에이전트 작업"
  }, context);
  await transitionRunPath(run.id, ["queued", "planning", "planned", "assigning", "preparing_workspace", "binding_app_server", "running"], context);
  await seedAgentControlSurface(run.id, body.workspaceId, body.repositoryId ?? defaultIdentity.repositoryId, body.objective ?? "새 멀티에이전트 작업", context);
  return (await core.getRun(run.id)) ?? run;
}

async function enqueueCommand(body: EnqueueCommandRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "enqueueCommand", `${body.runId}:${body.instruction}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const commandId = `cmd_${Date.now()}_${sanitizeId(body.runId)}`;
    const resourceClass = mapCommandIntentToResourceClass(body.resourceIntent);
    const state = resourceClass === "interactive" ? "ready" : "preparing";
    const item: CommandQueueItem = {
      commandId,
      runId: body.runId,
      instruction: body.instruction,
      state,
      resourceIntent: body.resourceIntent
    };
    if (body.selection) {
      (item as { selection: NonNullable<EnqueueCommandRequest["selection"]> }).selection = body.selection;
    }
    await appendEvent(commandId, "Command", "CommandQueued", item, context);
    await appendEvent(`terminal_${commandId}`, "Artifact", "TerminalOutputAppended", {
      lineId: `line_${commandId}_1`,
      runId: body.runId,
      stream: "system",
      text: body.selection ? `${body.selection.path}:${body.selection.fromLine}-${body.selection.toLine} 선택 범위 명령이 접수되었습니다.` : `${body.instruction} 명령이 접수되었습니다.`
    }, context);
    if (body.resourceIntent === "test") {
      await appendEvent(`artifact_${commandId}`, "Artifact", "ArtifactCreated", {
        artifactId: `artifact_${commandId}`,
        runId: body.runId,
        label: "테스트 실행 기록",
        contentType: "text/plain",
        sizeLabel: "pending"
      }, context);
    }
    return projection("user");
  });
}

async function decideApproval(body: ApprovalDecisionRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "decideApproval", `${body.approvalId}:${body.decision}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(body.approvalId, "ApprovalRequest", "ApprovalDecided", {
      approvalId: body.approvalId,
      decision: body.decision,
      reason: body.reason,
      runId: await latestRunId()
    }, context);
    const runId = await latestRunId();
    if (runId && body.decision === "approve") {
      const run = await core.getRun(runId);
      if (run?.state === "waiting_for_approval") {
        await core.transitionRun({ runId, to: "running" }, context);
      }
    }
    return projection("user");
  });
}

async function controlSupervisor(body: SupervisorControlRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "controlSupervisor", `${body.runId}:${body.action}:${body.reason}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const run = await core.getRun(body.runId);
    const observed = run ? run.state : "unknown";
    const decision: SupervisorDecision = {
      id: `decision_${Date.now()}_${body.action}`,
      runId: body.runId,
      observedState: observed,
      selectedAction: body.action,
      policyReason: body.reason,
      affectedAgents: body.targetAgentId ? [body.targetAgentId] : [],
      expectedVerification: ["timeline update", "lease state consistent"]
    };
    if (run) {
      await core.recordSupervisorDecision(decision, context);
      await applySupervisorStateTransition(body.runId, body.action, context);
    }
    if (body.action === "retry") {
      const recovery = (await projection("operator")).recoveryQueue.find((item) => item.runId === body.runId && item.state !== "resolved");
      if (recovery) {
        await appendEvent(recovery.recoveryId, "Recovery", "RecoveryUpdated", {
          ...recovery,
          state: "resolved",
          nextAction: "재시도 요청 완료"
        }, context);
      }
    }
    await appendEvent(`supervisor_action_${decision.id}`, "SupervisorDecision", "SupervisorControlActionRecorded", {
      runId: body.runId,
      action: body.action,
      targetAgentId: body.targetAgentId ?? "run",
      reason: body.reason
    }, context);
    return projection("user");
  });
}

async function escalateConflict(body: ConflictEscalationRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "escalateConflict", `${body.conflictId}:${body.reason}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(body.conflictId, "Conflict", "ConflictEscalated", {
      conflictId: body.conflictId,
      runId: (await latestRunId()) ?? "run_unknown",
      files: ["apps/web/src/server.ts"],
      summary: body.reason,
      state: "escalated"
    }, context);
    return projection("user");
  });
}

async function changeEditorSession(body: EditorSessionRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "changeEditorSession", `${body.workspaceId}:${body.action}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const payload: EditorSessionProjection =
      body.action === "revoke"
        ? {
            workspaceId: body.workspaceId,
            state: "revoked",
            message: "IDE 세션이 폐기되었습니다. 필요하면 새 세션을 발급할 수 있습니다."
          }
        : {
            workspaceId: body.workspaceId,
            state: "ready",
            publicRoute: `/editor/session/editor_${sanitizeId(body.workspaceId)}_${Date.now()}`,
            expiresAt: Date.now() + 30 * 60_000,
            message: "사용자 워크스페이스 전용 code-server 세션이 준비되었습니다."
          };
    await appendEvent(`editor_${body.workspaceId}`, "WorkspaceEditorSession", "EditorSessionChanged", payload, context);
    return projection("user");
  });
}

async function decideFinalReview(body: FinalReviewDecisionRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "decideFinalReview", `${body.runId}:${body.decision}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(`final_review_${body.runId}`, "FinalReview", "FinalReviewGateChanged", {
      runId: body.runId,
      state: body.decision === "approve" ? "approved" : "changes_requested",
      checklist: [
        { label: "변경 검토", done: true },
        { label: "테스트 확인", done: body.decision === "approve" },
        { label: "승인 정리", done: true }
      ]
    }, context);
    const run = await core.getRun(body.runId);
    if (body.decision === "approve" && run?.state === "ready_for_review") {
      await core.transitionRun({ runId: body.runId, to: "integrating" }, context);
      const refreshed = await core.getRun(body.runId);
      await core.completeRun(body.runId, refreshed?.supervisorDecisionId, context);
    }
    return projection("user");
  });
}

async function decideHunk(body: HunkDecisionRequest, requestId: string): Promise<ControlRoomProjectionResponse> {
  return withIdempotency(body.idempotencyKey, "decideHunk", `${body.path}:${body.hunkId}:${body.decision}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const current = (await projection("operator")).diff.find((file) => file.path === body.path);
    const updated: DiffFileItem = {
      path: body.path,
      additions: current?.additions ?? 0,
      deletions: current?.deletions ?? 0,
      hunks: (current?.hunks ?? [{ hunkId: body.hunkId, title: "Workbench hunk", additions: 0, deletions: 0, state: "pending" }]).map((hunk) =>
        hunk.hunkId === body.hunkId ? { ...hunk, state: body.decision === "approve" ? "approved" : "changes_requested" } : hunk
      )
    };
    await appendEvent(`diff_${sanitizeId(body.path)}`, "Diff", "DiffUpdated", updated, context);
    const approvalId = `approval_hunk_${sanitizeId(body.hunkId)}`;
    await appendEvent(approvalId, "ApprovalRequest", "ApprovalRequested", {
      approvalId,
      runId: await latestRunId(),
      reason: `Hunk ${body.hunkId} 검토`,
      state: "requested",
      destructive: false
    }, context);
    await appendEvent(approvalId, "ApprovalRequest", "ApprovalDecided", {
      approvalId,
      decision: body.decision === "approve" ? "approve" : "reject",
      reason: body.reason,
      runId: await latestRunId()
    }, context);
    await appendEvent(`terminal_hunk_${sanitizeId(body.hunkId)}`, "Artifact", "TerminalOutputAppended", {
      lineId: `line_hunk_${Date.now()}`,
      runId: (await latestRunId()) ?? "run_unknown",
      stream: "system",
      text: `Hunk ${body.hunkId} ${body.decision === "approve" ? "승인" : "변경 요청"} 처리되었습니다.`
    }, context);
    return projection("user");
  });
}

async function registerMobilePush(body: MobilePushRegistrationRequest, requestId: string) {
  return withIdempotency(body.idempotencyKey, "registerMobilePush", `${body.workspaceId}:${body.permission}:${body.routeOnClick}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(`mobile_push_${body.workspaceId}`, "MobileNotification", "MobilePushRegistrationChanged", {
      workspaceId: body.workspaceId,
      permission: body.permission,
      registered: body.permission === "granted" || body.permission === "default",
      endpointLabel: summarizeEndpoint(body.endpoint),
      routeOnClick: body.routeOnClick
    }, context);
    await appendEvent(`notification_mobile_push_${body.workspaceId}`, "Notification", "NotificationRaised", {
      notificationId: `notification_mobile_push_${sanitizeId(body.workspaceId)}`,
      title: "모바일 알림 경로 준비",
      body: "필요한 승인과 복구 알림이 모바일 inbox로 연결됩니다.",
      route: body.routeOnClick,
      unread: true
    }, context);
    return mobileProjection();
  });
}

async function updateNotificationSettings(body: NotificationSettingsRequest, requestId: string) {
  return withIdempotency(body.idempotencyKey, "updateNotificationSettings", `${body.workspaceId}:${body.enabled}:${body.approvals}:${body.recovery}:${body.finalReview}`, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(`mobile_settings_${body.workspaceId}`, "MobileNotification", "NotificationSettingsUpdated", body, context);
    await appendEvent(`notification_mobile_settings_${body.workspaceId}`, "Notification", "NotificationRaised", {
      notificationId: `notification_mobile_settings_${sanitizeId(body.workspaceId)}`,
      title: "알림 설정 저장",
      body: "사용자 결정이 필요한 항목만 모바일 inbox에 표시합니다.",
      route: "/mobile#notification-settings",
      unread: true
    }, context);
    return mobileProjection();
  });
}

async function markNotificationRead(body: NotificationReadRequest, requestId: string) {
  return withIdempotency(body.idempotencyKey, "markNotificationRead", body.notificationId, async () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    await appendEvent(body.notificationId, "Notification", "NotificationRead", {
      notificationId: body.notificationId
    }, context);
    return mobileProjection();
  });
}

async function seedAgentControlSurface(runId: string, workspaceId: string, repositoryId: string, objective: string, context: CoreCommandContext): Promise<void> {
  const supervisorAgentId = `agent_supervisor_${sanitizeId(runId)}`;
  const taskAgentId = `agent_task_${sanitizeId(runId)}`;
  await appendEvent(`${runId}_supervisor_hierarchy`, "Agent", "AgentHierarchyRecorded", {
    agentId: supervisorAgentId,
    runId,
    role: "SupervisorAgent",
    label: "SupervisorAgent",
    state: "observing"
  }, context);
  await appendEvent(`${runId}_task_hierarchy`, "Agent", "AgentHierarchyRecorded", {
    agentId: taskAgentId,
    parentAgentId: supervisorAgentId,
    runId,
    role: "TaskSupervisorAgent",
    label: "Implementation Task Supervisor",
    state: "working"
  }, context);
  const contracts: readonly AgentTaskContract[] = [
    makeContract("planner", runId, taskAgentId, workspaceId, repositoryId, objective, ["prompts/octop-agentic-ide", "docs"], ["infra/**"]),
    makeContract("builder", runId, taskAgentId, workspaceId, repositoryId, "Control Room UI와 Gateway API 구현", ["apps/web/src", "apps/gateway/src", "packages/api-contract/src"], [".env", "node_modules"]),
    makeContract("verifier", runId, taskAgentId, workspaceId, repositoryId, "테스트와 UI 검증 수행", ["packages/core-kernel/test", "reports"], [".env", "node_modules"])
  ];
  for (const contract of contracts) {
    await core.startAgentWork(contract, context);
    await appendEvent(`${runId}_${contract.id}_hierarchy`, "Agent", "AgentHierarchyRecorded", {
      agentId: `agent_${contract.id}`,
      parentAgentId: taskAgentId,
      runId,
      role: "RoleAgent",
      label: contract.objective,
      state: "working"
    }, context);
    await appendEvent(`${runId}_${contract.id}_lease`, "AgentLease", "AgentLeaseBudgetUpdated", {
      agentId: `agent_${contract.id}`,
      heartbeat: "fresh",
      timeoutLabel: "12분 남음",
      retryBudget: `${contract.retryBudget}회`,
      commandBudget: `${contract.commandBudget}개`
    }, context);
  }
  await appendEvent(`command_initial_${runId}`, "Command", "CommandQueued", {
    commandId: `cmd_initial_${sanitizeId(runId)}`,
    runId,
    instruction: "워크스페이스 분석과 구현 계획을 시작합니다.",
    state: "ready",
    resourceIntent: "light"
  }, context);
  await appendEvent(`approval_${runId}_scope`, "ApprovalRequest", "ApprovalRequested", {
    approvalId: `approval_${sanitizeId(runId)}_scope`,
    runId,
    reason: "작업 범위 확장 또는 destructive 변경이 필요하면 여기서 승인합니다.",
    state: "requested",
    destructive: false
  }, context);
  await appendEvent(`notification_${runId}_approval`, "Notification", "NotificationRaised", {
    notificationId: `notification_${sanitizeId(runId)}_approval`,
    title: "승인 검토 필요",
    body: "작업 범위 변경 요청을 모바일에서 검토할 수 있습니다.",
    route: `/mobile#approval-${sanitizeId(`approval_${sanitizeId(runId)}_scope`)}`,
    unread: true
  }, context);
  await appendEvent(`conflict_${runId}_initial`, "Conflict", "ConflictDetected", {
    conflictId: `conflict_${sanitizeId(runId)}_initial`,
    runId,
    files: ["apps/web/src/server.ts"],
    summary: "UI shell 교체 중 hunk 단위 검토가 필요합니다.",
    state: "detected"
  }, context);
  await appendEvent(`notification_${runId}_conflict`, "Notification", "NotificationRaised", {
    notificationId: `notification_${sanitizeId(runId)}_conflict`,
    title: "충돌 검토",
    body: "파일 충돌 요약을 확인하고 escalation 여부를 결정하십시오.",
    route: `/mobile#conflict-${sanitizeId(`conflict_${sanitizeId(runId)}_initial`)}`,
    unread: true
  }, context);
  await appendEvent(`recovery_${runId}_editor`, "Recovery", "RecoveryQueued", {
    recoveryId: `recovery_${sanitizeId(runId)}_editor`,
    runId,
    title: "IDE 세션 재발급 준비",
    state: "ready_to_retry",
    nextAction: "세션 재발급"
  }, context);
  await appendEvent(`notification_${runId}_recovery`, "Notification", "NotificationRaised", {
    notificationId: `notification_${sanitizeId(runId)}_recovery`,
    title: "복구 결정 준비",
    body: "워크스페이스 복구 action을 모바일에서 재시도할 수 있습니다.",
    route: `/mobile#recovery-${sanitizeId(`recovery_${sanitizeId(runId)}_editor`)}`,
    unread: true
  }, context);
  await appendEvent(`diff_${runId}_web`, "Diff", "DiffUpdated", {
    path: "apps/web/src/server.ts",
    additions: 180,
    deletions: 24,
    hunks: [
      { hunkId: `hunk_${sanitizeId(runId)}_layout`, title: "3-pane Control Room layout", additions: 96, deletions: 12, state: "pending" },
      { hunkId: `hunk_${sanitizeId(runId)}_stream`, title: "Realtime reconnect client", additions: 84, deletions: 12, state: "pending" }
    ]
  } satisfies DiffFileItem, context);
  await appendEvent(`final_review_${runId}`, "FinalReview", "FinalReviewGateChanged", {
    runId,
    state: "not_ready",
    checklist: [
      { label: "변경 검토", done: false },
      { label: "테스트 확인", done: false },
      { label: "승인 정리", done: false }
    ]
  }, context);
  await core.recordSupervisorDecision(
    {
      id: `decision_${sanitizeId(runId)}_start`,
      runId,
      observedState: "running",
      selectedAction: "assign scoped contracts",
      policyReason: "AgentTaskContract와 WorkScope 기준으로 하위 agent를 통제합니다.",
      affectedAgents: contracts.map((contract) => `agent_${contract.id}`),
      expectedVerification: ["contracts accepted", "timeline updated", "approval inbox visible"]
    },
    context
  );
}

function makeContract(
  suffix: string,
  runId: string,
  parentAgentId: string,
  workspaceId: string,
  repositoryId: string,
  objective: string,
  ownedFiles: readonly string[],
  forbiddenFiles: readonly string[]
): AgentTaskContract {
  return {
    id: `contract_${sanitizeId(runId)}_${suffix}`,
    parentRunId: runId,
    parentAgentId,
    tenantId: defaultIdentity.tenantId,
    workspaceId,
    repositoryId,
    branch: "main",
    objective,
    allowedTools: ["read", "edit", "test", "report"],
    ownedFiles,
    forbiddenFiles,
    workScope: {
      workspaceId,
      rootPath: "/workspace",
      allowedPaths: ownedFiles
    },
    commandBudget: suffix === "verifier" ? 10 : 16,
    tokenBudget: 200000,
    retryBudget: 2,
    wallClockBudgetMs: 90 * 60_000,
    resourceClass: suffix === "verifier" ? "test" : "interactive",
    requiresCapacityReservation: suffix === "verifier",
    dependencies: [],
    outputSchema: { type: "object", required: ["summary", "verification"] },
    verificationCommands: ["npm run core:gate"],
    escalationTriggers: ["scope expansion", "destructive action", "file conflict"],
    cancellationToken: `cancel_${sanitizeId(runId)}_${suffix}`,
    heartbeatIntervalMs: 30_000,
    doneCriteria: ["changes implemented", "tests passed", "report recorded"]
  };
}

async function transitionRunPath(runId: string, pathToApply: readonly RunState[], context: CoreCommandContext): Promise<void> {
  for (const next of pathToApply) {
    const run = await core.getRun(runId);
    if (!run || !RUN_TRANSITIONS[run.state].includes(next)) {
      continue;
    }
    await core.transitionRun({ runId, to: next }, context);
  }
}

async function applySupervisorStateTransition(runId: string, action: SupervisorControlRequest["action"], context: CoreCommandContext): Promise<void> {
  const run = await core.getRun(runId);
  if (!run) return;
  const nextByAction: Partial<Record<SupervisorControlRequest["action"], RunState>> = {
    pause: "waiting_for_input",
    resume: "running",
    cancel: "cancelled",
    retry: run.state === "failed" ? "recovering" : "running",
    accept_report: "verifying",
    reject_report: "running"
  };
  const next = nextByAction[action];
  if (next && RUN_TRANSITIONS[run.state].includes(next)) {
    await core.transitionRun({ runId, to: next }, context);
  }
}

async function projection(role: "user" | "operator"): Promise<ControlRoomProjectionResponse> {
  const fileTree = (await workspaceRuntime.readFileTree(defaultIdentity.workspaceId, "")).items;
  return rebuildControlRoomProjection(await core.readAll(), { role, fileTree });
}

async function mobileProjection() {
  return rebuildMobileCommandReviewProjection(await core.readAll());
}

async function ensureDefaultSeed(requestId: string): Promise<void> {
  if (!(await core.getIdentitySeed(defaultIdentity.tenantId, defaultIdentity.userId, defaultIdentity.workspaceId))) {
    await seedIdentity(defaultIdentity, requestId);
  }
}

async function latestRunId(): Promise<string | undefined> {
  return [...(await core.readAll())].reverse().find((event) => event.aggregateType === "Run")?.aggregateId;
}

async function appendIfMissing<TPayload>(aggregateId: string, aggregateType: string, type: string, payload: TPayload, context: CoreCommandContext): Promise<DomainEvent<TPayload> | undefined> {
  return core.appendIfMissing({ aggregateId, aggregateType, type, schemaVersion: 1, payload, metadata: context }) as Promise<DomainEvent<TPayload> | undefined>;
}

async function appendEvent<TPayload>(aggregateId: string, aggregateType: string, type: string, payload: TPayload, context: CoreCommandContext): Promise<DomainEvent<TPayload>> {
  return core.append({ aggregateId, aggregateType, type, schemaVersion: 1, payload, metadata: context }) as Promise<DomainEvent<TPayload>>;
}

async function withIdempotency<TResult>(key: string, commandName: string, requestHash: string, execute: () => Promise<TResult>): Promise<TResult> {
  const cached = await core.getIdempotency<TResult>(key);
  if (cached) {
    return cached.result;
  }
  const result = await execute();
  await core.putIdempotency({ key, commandName, requestHash, result });
  return result;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function summarizeEndpoint(value: string): string {
  const suffix = sanitizeId(value).slice(-12);
  return suffix ? `registered_${suffix}` : "registered";
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

async function readDependencyHealth(url: string): Promise<{ readonly ok: boolean; readonly status?: number; readonly error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "dependency_check_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-request-id"
  });
  response.end(JSON.stringify(body));
}

function sendEmpty(response: http.ServerResponse, status: number): void {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-request-id"
  });
  response.end();
}

function log(level: "info" | "error", msg: string, fields: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ level, msg, service: "gateway", ...fields }) + "\n");
}
