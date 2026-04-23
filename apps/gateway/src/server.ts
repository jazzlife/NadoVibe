import http from "node:http";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
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
  parseSupervisorControlRequest,
  parseWorkspaceFileWriteRequest,
  parseWorkspaceSearchRequest,
  publicProjection,
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
  SupervisorControlRequest
} from "@nadovibe/api-contract";
import {
  CoreControlPlane,
  RUN_TRANSITIONS,
  type AgentTaskContract,
  type CoreCommandContext,
  type DomainEvent,
  type RunState,
  type SupervisorDecision
} from "@nadovibe/core-kernel";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

const port = Number.parseInt(process.env.GATEWAY_PORT ?? "8080", 10);
const core = new CoreControlPlane();
const workspaceRoot = path.resolve(process.env.NADOVIBE_WORKSPACE_ROOT ?? process.cwd());
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
      sendJson(response, 200, { ok: true, service: "gateway", dependency: "core", requestId });
      return;
    }
    if (request.url === "/readyz") {
      sendJson(response, 200, { ok: true, service: "gateway", dependency: "core", eventCount: core.events.readAll().length, requestId });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/control-room")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const role = url.searchParams.get("role") === "operator" ? "operator" : "user";
      sendJson(response, 200, projection(role));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/dev/seed") {
      const body = parseDevIdentitySeedRequest(await readJson(request));
      const seed = seedIdentity(body, requestId);
      sendJson(response, 201, { seed });
      return;
    }
    if (request.method === "POST" && request.url === "/api/dev/seed") {
      const body = parseDevIdentitySeedRequest(await readJson(request));
      const seed = seedIdentity(body, requestId);
      sendJson(response, 201, { seed });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const run = createRun(body, requestId);
      sendJson(response, 201, { run });
      return;
    }
    if (request.method === "POST" && request.url === "/api/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const run = createRun(body, requestId);
      const payload = { runId: run.id, status: mapInternalRunStateToUserStatus(run.state), requestId, projection: projection("user") };
      assertPublicResponseSafe(payload);
      sendJson(response, 202, payload);
      return;
    }
    if (request.method === "POST" && request.url === "/api/commands") {
      const body = parseEnqueueCommandRequest(await readJson(request));
      sendJson(response, 202, enqueueCommand(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/approvals/decision") {
      const body = parseApprovalDecisionRequest(await readJson(request));
      sendJson(response, 202, decideApproval(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/supervisor/control") {
      const body = parseSupervisorControlRequest(await readJson(request));
      sendJson(response, 202, controlSupervisor(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/conflicts/escalate") {
      const body = parseConflictEscalationRequest(await readJson(request));
      sendJson(response, 202, escalateConflict(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/editor-session") {
      const body = parseEditorSessionRequest(await readJson(request));
      sendJson(response, 202, changeEditorSession(body, requestId));
      return;
    }
    if (request.method === "POST" && request.url === "/api/final-review") {
      const body = parseFinalReviewDecisionRequest(await readJson(request));
      sendJson(response, 202, decideFinalReview(body, requestId));
      return;
    }
    if (request.method === "GET" && request.url === "/api/projections") {
      const projection = publicProjection(rebuildPlatformReadModels(core.events.readAll()));
      assertPublicResponseSafe(projection);
      sendJson(response, 200, projection);
      return;
    }
    if (request.method === "GET" && request.url === "/api/admin/capacity") {
      const readModels = rebuildPlatformReadModels(core.events.readAll());
      sendJson(response, 200, { ...readModels.resources, queueDepth: 0 });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/files/tree")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const workspaceId = url.searchParams.get("workspaceId") ?? defaultIdentity.workspaceId;
      const requestedPath = url.searchParams.get("path") ?? "";
      sendJson(response, 200, { workspaceId, items: readFileTree(requestedPath) });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/files/read")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const requestedPath = url.searchParams.get("path") ?? "";
      const absolute = safeWorkspacePath(requestedPath);
      const stat = statSync(absolute);
      if (!stat.isFile() || stat.size > 160_000) {
        throw new Error("file is not readable through Gateway");
      }
      sendJson(response, 200, { path: requestedPath, content: readFileSync(absolute, "utf8") });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/workspace/search")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const body = parseWorkspaceSearchRequest({
        workspaceId: url.searchParams.get("workspaceId") ?? defaultIdentity.workspaceId,
        query: url.searchParams.get("query") ?? "",
        path: url.searchParams.get("path") ?? ""
      });
      sendJson(response, 200, searchWorkspace(body.workspaceId, body.query, body.path ?? ""));
      return;
    }
    if (request.method === "POST" && request.url === "/api/workspace/files/write") {
      const body = parseWorkspaceFileWriteRequest(await readJson(request));
      if (!body.fileLeaseId.startsWith("lease_")) {
        throw new Error("active FileLease is required");
      }
      const absolute = safeWorkspacePath(body.path);
      writeFileSync(absolute, body.content, "utf8");
      appendEvent("file_write_" + sanitizeId(body.path), "WorkspaceFile", "WorkspaceFileWritten", {
        workspaceId: body.workspaceId,
        path: body.path,
        runId: latestRunId(),
        message: "파일 저장 완료"
      }, contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId));
      appendEvent("diff_write_" + sanitizeId(body.path), "Diff", "DiffUpdated", {
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
      sendJson(response, 202, projection("user"));
      return;
    }
    if (request.method === "POST" && request.url === "/api/diff/hunks/decision") {
      const body = parseHunkDecisionRequest(await readJson(request));
      sendJson(response, 202, decideHunk(body, requestId));
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/stream")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const after = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
      const frames = replayStreamFromOffset(core.events.readAll(), Number.isFinite(after) ? after : 0);
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

function seedIdentity(body: DevIdentitySeedRequest, requestId: string) {
  const context = contextFromSeed(body.tenantId, body.userId, requestId);
  const seed = core.seedIdentity({ ...body, idempotencyKey: `seed:${body.tenantId}:${body.userId}:${body.workspaceId}`, membershipRole: "owner" }, context);
  appendIfMissing(body.workspaceId, "Workspace", "WorkspaceCatalogSeeded", {
    workspaceId: body.workspaceId,
    workspaceName: "NadoVibe Platform",
    repositoryId: body.repositoryId,
    repositoryName: "NadoVibe",
    branch: "main"
  }, context);
  appendIfMissing(`workspace_status_${body.workspaceId}`, "WorkspaceRuntime", "WorkspaceRuntimeStateChanged", {
    workspaceId: body.workspaceId,
    to: "ready"
  }, context);
  log("info", "seeded identity through Core command API", { requestId, tenantId: seed.tenantId, workspaceId: seed.workspaceId });
  return seed;
}

function createRun(body: CreateRunRequest, requestId: string) {
  const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
  ensureDefaultSeed(requestId);
  const run = core.createRun(body, context);
  appendEvent(`run_objective_${run.id}`, "RunProjection", "RunObjectiveUpdated", {
    runId: run.id,
    objective: body.objective ?? "새 멀티에이전트 작업"
  }, context);
  transitionRunPath(run.id, ["queued", "planning", "planned", "assigning", "preparing_workspace", "binding_app_server", "running"], context);
  seedAgentControlSurface(run.id, body.workspaceId, body.repositoryId ?? defaultIdentity.repositoryId, body.objective ?? "새 멀티에이전트 작업", context);
  return core.getRun(run.id) ?? run;
}

function enqueueCommand(body: EnqueueCommandRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "enqueueCommand", `${body.runId}:${body.instruction}`, () => {
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
    appendEvent(commandId, "Command", "CommandQueued", item, context);
    appendEvent(`terminal_${commandId}`, "Artifact", "TerminalOutputAppended", {
      lineId: `line_${commandId}_1`,
      runId: body.runId,
      stream: "system",
      text: body.selection ? `${body.selection.path}:${body.selection.fromLine}-${body.selection.toLine} 선택 범위 명령이 접수되었습니다.` : `${body.instruction} 명령이 접수되었습니다.`
    }, context);
    if (body.resourceIntent === "test") {
      appendEvent(`artifact_${commandId}`, "Artifact", "ArtifactCreated", {
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

function decideApproval(body: ApprovalDecisionRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "decideApproval", `${body.approvalId}:${body.decision}`, () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    appendEvent(body.approvalId, "ApprovalRequest", "ApprovalDecided", {
      approvalId: body.approvalId,
      decision: body.decision,
      reason: body.reason,
      runId: latestRunId()
    }, context);
    const runId = latestRunId();
    if (runId && body.decision === "approve") {
      const run = core.getRun(runId);
      if (run?.state === "waiting_for_approval") {
        core.transitionRun({ runId, to: "running" }, context);
      }
    }
    return projection("user");
  });
}

function controlSupervisor(body: SupervisorControlRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "controlSupervisor", `${body.runId}:${body.action}:${body.reason}`, () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const run = core.getRun(body.runId);
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
      core.recordSupervisorDecision(decision, context);
      applySupervisorStateTransition(body.runId, body.action, context);
    }
    appendEvent(`supervisor_action_${decision.id}`, "SupervisorDecision", "SupervisorControlActionRecorded", {
      runId: body.runId,
      action: body.action,
      targetAgentId: body.targetAgentId ?? "run",
      reason: body.reason
    }, context);
    return projection("user");
  });
}

function escalateConflict(body: ConflictEscalationRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "escalateConflict", `${body.conflictId}:${body.reason}`, () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    appendEvent(body.conflictId, "Conflict", "ConflictEscalated", {
      conflictId: body.conflictId,
      runId: latestRunId() ?? "run_unknown",
      files: ["apps/web/src/server.ts"],
      summary: body.reason,
      state: "escalated"
    }, context);
    return projection("user");
  });
}

function changeEditorSession(body: EditorSessionRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "changeEditorSession", `${body.workspaceId}:${body.action}`, () => {
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
    appendEvent(`editor_${body.workspaceId}`, "WorkspaceEditorSession", "EditorSessionChanged", payload, context);
    return projection("user");
  });
}

function decideFinalReview(body: FinalReviewDecisionRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "decideFinalReview", `${body.runId}:${body.decision}`, () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    appendEvent(`final_review_${body.runId}`, "FinalReview", "FinalReviewGateChanged", {
      runId: body.runId,
      state: body.decision === "approve" ? "approved" : "changes_requested",
      checklist: [
        { label: "변경 검토", done: true },
        { label: "테스트 확인", done: body.decision === "approve" },
        { label: "승인 정리", done: true }
      ]
    }, context);
    const run = core.getRun(body.runId);
    if (body.decision === "approve" && run?.state === "ready_for_review") {
      core.transitionRun({ runId: body.runId, to: "integrating" }, context);
      const refreshed = core.getRun(body.runId);
      core.completeRun(body.runId, refreshed?.supervisorDecisionId, context);
    }
    return projection("user");
  });
}

function decideHunk(body: HunkDecisionRequest, requestId: string): ControlRoomProjectionResponse {
  return withIdempotency(body.idempotencyKey, "decideHunk", `${body.path}:${body.hunkId}:${body.decision}`, () => {
    const context = contextFromSeed(defaultIdentity.tenantId, defaultIdentity.userId, requestId);
    const current = projection("operator").diff.find((file) => file.path === body.path);
    const updated: DiffFileItem = {
      path: body.path,
      additions: current?.additions ?? 0,
      deletions: current?.deletions ?? 0,
      hunks: (current?.hunks ?? [{ hunkId: body.hunkId, title: "Workbench hunk", additions: 0, deletions: 0, state: "pending" }]).map((hunk) =>
        hunk.hunkId === body.hunkId ? { ...hunk, state: body.decision === "approve" ? "approved" : "changes_requested" } : hunk
      )
    };
    appendEvent(`diff_${sanitizeId(body.path)}`, "Diff", "DiffUpdated", updated, context);
    const approvalId = `approval_hunk_${sanitizeId(body.hunkId)}`;
    appendEvent(approvalId, "ApprovalRequest", "ApprovalRequested", {
      approvalId,
      runId: latestRunId(),
      reason: `Hunk ${body.hunkId} 검토`,
      state: "requested",
      destructive: false
    }, context);
    appendEvent(approvalId, "ApprovalRequest", "ApprovalDecided", {
      approvalId,
      decision: body.decision === "approve" ? "approve" : "reject",
      reason: body.reason,
      runId: latestRunId()
    }, context);
    appendEvent(`terminal_hunk_${sanitizeId(body.hunkId)}`, "Artifact", "TerminalOutputAppended", {
      lineId: `line_hunk_${Date.now()}`,
      runId: latestRunId() ?? "run_unknown",
      stream: "system",
      text: `Hunk ${body.hunkId} ${body.decision === "approve" ? "승인" : "변경 요청"} 처리되었습니다.`
    }, context);
    return projection("user");
  });
}

function seedAgentControlSurface(runId: string, workspaceId: string, repositoryId: string, objective: string, context: CoreCommandContext): void {
  const supervisorAgentId = `agent_supervisor_${sanitizeId(runId)}`;
  const taskAgentId = `agent_task_${sanitizeId(runId)}`;
  appendEvent(`${runId}_supervisor_hierarchy`, "Agent", "AgentHierarchyRecorded", {
    agentId: supervisorAgentId,
    runId,
    role: "SupervisorAgent",
    label: "SupervisorAgent",
    state: "observing"
  }, context);
  appendEvent(`${runId}_task_hierarchy`, "Agent", "AgentHierarchyRecorded", {
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
    core.startAgentWork(contract, context);
    appendEvent(`${runId}_${contract.id}_hierarchy`, "Agent", "AgentHierarchyRecorded", {
      agentId: `agent_${contract.id}`,
      parentAgentId: taskAgentId,
      runId,
      role: "RoleAgent",
      label: contract.objective,
      state: "working"
    }, context);
    appendEvent(`${runId}_${contract.id}_lease`, "AgentLease", "AgentLeaseBudgetUpdated", {
      agentId: `agent_${contract.id}`,
      heartbeat: "fresh",
      timeoutLabel: "12분 남음",
      retryBudget: `${contract.retryBudget}회`,
      commandBudget: `${contract.commandBudget}개`
    }, context);
  }
  appendEvent(`command_initial_${runId}`, "Command", "CommandQueued", {
    commandId: `cmd_initial_${sanitizeId(runId)}`,
    runId,
    instruction: "워크스페이스 분석과 구현 계획을 시작합니다.",
    state: "ready",
    resourceIntent: "light"
  }, context);
  appendEvent(`approval_${runId}_scope`, "ApprovalRequest", "ApprovalRequested", {
    approvalId: `approval_${sanitizeId(runId)}_scope`,
    runId,
    reason: "작업 범위 확장 또는 destructive 변경이 필요하면 여기서 승인합니다.",
    state: "requested",
    destructive: false
  }, context);
  appendEvent(`conflict_${runId}_initial`, "Conflict", "ConflictDetected", {
    conflictId: `conflict_${sanitizeId(runId)}_initial`,
    runId,
    files: ["apps/web/src/server.ts"],
    summary: "UI shell 교체 중 hunk 단위 검토가 필요합니다.",
    state: "detected"
  }, context);
  appendEvent(`recovery_${runId}_editor`, "Recovery", "RecoveryQueued", {
    recoveryId: `recovery_${sanitizeId(runId)}_editor`,
    runId,
    title: "IDE 세션 재발급 준비",
    state: "ready_to_retry",
    nextAction: "세션 재발급"
  }, context);
  appendEvent(`diff_${runId}_web`, "Diff", "DiffUpdated", {
    path: "apps/web/src/server.ts",
    additions: 180,
    deletions: 24,
    hunks: [
      { hunkId: `hunk_${sanitizeId(runId)}_layout`, title: "3-pane Control Room layout", additions: 96, deletions: 12, state: "pending" },
      { hunkId: `hunk_${sanitizeId(runId)}_stream`, title: "Realtime reconnect client", additions: 84, deletions: 12, state: "pending" }
    ]
  } satisfies DiffFileItem, context);
  appendEvent(`final_review_${runId}`, "FinalReview", "FinalReviewGateChanged", {
    runId,
    state: "not_ready",
    checklist: [
      { label: "변경 검토", done: false },
      { label: "테스트 확인", done: false },
      { label: "승인 정리", done: false }
    ]
  }, context);
  core.recordSupervisorDecision(
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

function transitionRunPath(runId: string, pathToApply: readonly RunState[], context: CoreCommandContext): void {
  for (const next of pathToApply) {
    const run = core.getRun(runId);
    if (!run || !RUN_TRANSITIONS[run.state].includes(next)) {
      continue;
    }
    core.transitionRun({ runId, to: next }, context);
  }
}

function applySupervisorStateTransition(runId: string, action: SupervisorControlRequest["action"], context: CoreCommandContext): void {
  const run = core.getRun(runId);
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
    core.transitionRun({ runId, to: next }, context);
  }
}

function projection(role: "user" | "operator"): ControlRoomProjectionResponse {
  return rebuildControlRoomProjection(core.events.readAll(), { role, fileTree: readFileTree("") });
}

function ensureDefaultSeed(requestId: string): void {
  if (!core.getIdentitySeed(defaultIdentity.tenantId, defaultIdentity.userId, defaultIdentity.workspaceId)) {
    seedIdentity(defaultIdentity, requestId);
  }
}

function latestRunId(): string | undefined {
  return [...core.events.readAll()].reverse().find((event) => event.aggregateType === "Run")?.aggregateId;
}

function appendIfMissing<TPayload>(aggregateId: string, aggregateType: string, type: string, payload: TPayload, context: CoreCommandContext): DomainEvent<TPayload> | undefined {
  if (core.events.readAggregate(aggregateId).some((event) => event.type === type)) {
    return undefined;
  }
  return appendEvent(aggregateId, aggregateType, type, payload, context);
}

function appendEvent<TPayload>(aggregateId: string, aggregateType: string, type: string, payload: TPayload, context: CoreCommandContext): DomainEvent<TPayload> {
  const expected = core.events.readAggregate(aggregateId).at(-1)?.aggregateVersion ?? 0;
  return core.events.append({ aggregateId, aggregateType, type, schemaVersion: 1, payload, metadata: context }, expected);
}

function withIdempotency<TResult>(key: string, commandName: string, requestHash: string, execute: () => TResult): TResult {
  const cached = core.idempotency.get<TResult>(key);
  if (cached) {
    return cached.result;
  }
  const result = execute();
  core.idempotency.put({ key, commandName, requestHash, result });
  return result;
}

function readFileTree(requestedPath: string): readonly FileTreeItem[] {
  const base = safeWorkspacePath(requestedPath);
  const items: FileTreeItem[] = [];
  walk(base, path.relative(workspaceRoot, base), 0, items);
  return items.slice(0, 180);
}

function searchWorkspace(workspaceId: string, query: string, requestedPath: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return { workspaceId, query, results: [] };
  }
  const base = safeWorkspacePath(requestedPath);
  const results: Array<{ path: string; line: number; preview: string }> = [];
  searchWalk(base, normalizedQuery, results);
  return { workspaceId, query, results: results.slice(0, 40) };
}

function searchWalk(absolute: string, query: string, results: Array<{ path: string; line: number; preview: string }>, depth = 0): void {
  if (depth > 4 || results.length >= 40) return;
  const stat = statSync(absolute);
  if (stat.isFile()) {
    const relative = path.relative(workspaceRoot, absolute).replace(/\\/g, "/");
    if (relative.toLowerCase().includes(query)) {
      results.push({ path: relative, line: 1, preview: relative });
    }
    if (stat.size > 160_000 || !/\.(ts|tsx|js|jsx|json|md|css|html|yml|yaml|mjs|cjs)$/.test(relative)) return;
    const lines = readFileSync(absolute, "utf8").split(/\r?\n/);
    const hitIndex = lines.findIndex((line) => line.toLowerCase().includes(query));
    if (hitIndex >= 0) {
      results.push({ path: relative, line: hitIndex + 1, preview: lines[hitIndex]?.trim().slice(0, 160) ?? "" });
    }
    return;
  }
  if (!stat.isDirectory()) return;
  const entries = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => ![".git", "node_modules", "dist", "coverage", ".DS_Store", "test-results", "playwright-report"].includes(entry.name))
    .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))
    .slice(0, 120);
  for (const entry of entries) {
    searchWalk(path.join(absolute, entry.name), query, results, depth + 1);
    if (results.length >= 40) return;
  }
}

function walk(absolute: string, relativePath: string, depth: number, items: FileTreeItem[]): void {
  if (depth > 2 || items.length >= 180) return;
  const entries = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => ![".git", "node_modules", "dist", "coverage", ".DS_Store"].includes(entry.name))
    .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))
    .slice(0, 80);
  for (const entry of entries) {
    const childAbsolute = path.join(absolute, entry.name);
    const childRelative = path.join(relativePath, entry.name).replace(/\\/g, "/").replace(/^\.\//, "");
    items.push({ path: childRelative, name: entry.name, type: entry.isDirectory() ? "directory" : "file", depth });
    if (entry.isDirectory()) {
      walk(childAbsolute, childRelative, depth + 1, items);
    }
  }
}

function safeWorkspacePath(requestedPath: string): string {
  const relative = path.normalize(requestedPath || ".").replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(workspaceRoot, relative);
  const inside = absolute === workspaceRoot || absolute.startsWith(workspaceRoot + path.sep);
  if (!inside) {
    throw new Error("path is outside workspace");
  }
  return absolute;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
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
