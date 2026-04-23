import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentBudgetTracker,
  AppServerHandshakeGate,
  AppServerSchemaRegistry,
  CapacityAdmissionController,
  CoreControlPlane,
  CoreInvariantError,
  InMemoryEventJournal,
  OptimisticConcurrencyError,
  SecretPayloadError,
  TenantFairQueue,
  assertDedicatedCodeServer,
  assertEditorSessionUsable,
  assertLeaseActive,
  assertWriteFileAllowed,
  classifyAppServerMethod,
  classifyOverloadError,
  createOfficialDocsSchemaArtifact,
  issueEditorSession,
  validateJsonRpcEnvelope,
  validateMethodPolicyCoverage,
  validateTransportConfig,
  type AgentTaskContract,
  type CoreCommandContext,
  type FileLease,
  type WorkScope
} from "@nadovibe/core-kernel";

const context: CoreCommandContext = {
  tenantId: "tenant_a",
  userId: "user_a",
  requestId: "req_1",
  correlationId: "corr_1",
  sourceService: "core-gate-test",
  actor: { type: "user", id: "user_a" }
};

test("app-server schema registry covers every official-docs method with allow, deny, or route", () => {
  const artifact = createOfficialDocsSchemaArtifact();
  assert.deepEqual(validateMethodPolicyCoverage(artifact.methods), []);
  const registry = new AppServerSchemaRegistry();
  registry.register(artifact);
  assert.equal(registry.requireCurrent("official-docs-2026-04-23").methods.length > 20, true);
});

test("app-server policy denies shellCommand and routes exec/fs through Workspace Runtime", () => {
  assert.equal(classifyAppServerMethod("thread/shellCommand").action, "deny");
  assert.equal(classifyAppServerMethod("command/exec").action, "route");
  assert.equal(classifyAppServerMethod("command/exec/write").action, "route");
  assert.equal(classifyAppServerMethod("fs/writeFile").action, "route");
  assert.equal(classifyAppServerMethod("config/value/write").action, "deny");
  assert.throws(() => classifyAppServerMethod("unknown/newMethod"), /Unclassified/);
});

test("JSON-RPC envelope and initialize gate enforce app-server protocol order", () => {
  assert.deepEqual(validateJsonRpcEnvelope({ method: "initialize", id: 1, params: {} }), {
    method: "initialize",
    id: 1,
    params: {}
  });
  assert.throws(() => validateJsonRpcEnvelope({ id: 1, params: {} }), /neither request/);
  const gate = new AppServerHandshakeGate();
  assert.throws(() => gate.observe("thread/start"), /before initialize/);
  gate.observe("initialize");
  assert.throws(() => gate.observe("thread/start"), /before initialize/);
  gate.observe("initialized");
  assert.doesNotThrow(() => gate.observe("thread/start"));
});

test("unsupported production WebSocket and retryable overload are classified", () => {
  assert.throws(
    () => validateTransportConfig({ listen: "websocket", host: "0.0.0.0", environment: "production" }),
    /unsupported/
  );
  assert.throws(
    () => validateTransportConfig({ listen: "websocket", host: "127.0.0.1", environment: "development" }),
    /requires explicit auth/
  );
  assert.equal(classifyOverloadError({ code: -32001, message: "Server overloaded; retry later." }), "retryable");
});

test("event journal enforces optimistic concurrency and secret-free payloads", () => {
  const journal = new InMemoryEventJournal();
  journal.append(
    {
      aggregateId: "run_1",
      aggregateType: "Run",
      type: "RunCreated",
      schemaVersion: 1,
      payload: { state: "draft" },
      metadata: { ...context }
    },
    0
  );
  assert.throws(
    () =>
      journal.append(
        {
          aggregateId: "run_1",
          aggregateType: "Run",
          type: "RunCreated",
          schemaVersion: 1,
          payload: { state: "draft" },
          metadata: { ...context }
        },
        0
      ),
    OptimisticConcurrencyError
  );
  assert.throws(
    () =>
      journal.append(
        {
          aggregateId: "run_2",
          aggregateType: "Run",
          type: "RunCreated",
          schemaVersion: 1,
          payload: { apiKey: "sk-this-must-not-be-stored" },
          metadata: { ...context }
        },
        0
      ),
    SecretPayloadError
  );
});

test("Core run state machine blocks invalid transitions and requires SupervisorDecision for completion", () => {
  const core = new CoreControlPlane();
  const created = core.createRun({ idempotencyKey: "idem_1", runId: "run_1", workspaceId: "workspace_1" }, context);
  assert.equal(created.state, "draft");
  assert.equal(core.createRun({ idempotencyKey: "idem_1", runId: "run_1", workspaceId: "workspace_1" }, context).id, "run_1");
  assert.throws(() => core.transitionRun({ runId: "run_1", to: "completed" }, context), CoreInvariantError);
  core.transitionRun({ runId: "run_1", to: "queued" }, context);
  core.transitionRun({ runId: "run_1", to: "planning" }, context);
  core.transitionRun({ runId: "run_1", to: "planned" }, context);
  core.transitionRun({ runId: "run_1", to: "assigning" }, context);
  core.transitionRun({ runId: "run_1", to: "preparing_workspace" }, context);
  core.transitionRun({ runId: "run_1", to: "binding_app_server" }, context);
  core.transitionRun({ runId: "run_1", to: "running" }, context);
  core.transitionRun({ runId: "run_1", to: "verifying" }, context);
  core.transitionRun({ runId: "run_1", to: "ready_for_review" }, context);
  core.transitionRun({ runId: "run_1", to: "integrating" }, context);
  assert.throws(() => core.completeRun("run_1", undefined, context), /SupervisorDecision/);
  core.recordSupervisorDecision(
    {
      id: "decision_1",
      runId: "run_1",
      observedState: "integrating",
      selectedAction: "complete",
      policyReason: "all verification passed",
      affectedAgents: [],
      expectedVerification: ["core gate"]
    },
    context
  );
  assert.equal(core.completeRun("run_1", "decision_1", context).state, "completed");
});

test("Core replay restores run state from event journal", () => {
  const core = new CoreControlPlane();
  core.createRun({ idempotencyKey: "idem_replay", runId: "run_replay", workspaceId: "workspace_1" }, context);
  core.transitionRun({ runId: "run_replay", to: "queued" }, context);
  const restored = new CoreControlPlane();
  restored.replay(core.events.readAll());
  assert.equal(restored.getRun("run_replay")?.state, "queued");
});

test("capacity admission reserves fairly and blocks heavy dispatch without active reservation", () => {
  const capacity = new CapacityAdmissionController();
  capacity.setGlobalQuota({ maxConcurrent: 1, maxByClass: { build: 1 } });
  const now = 1_000;
  const first = capacity.reserve({
    tenantId: "tenant_a",
    userId: "user_a",
    workspaceId: "workspace_a",
    runId: "run_a",
    commandId: "cmd_a",
    resourceClass: "build",
    now,
    ttlMs: 1_000
  });
  assert.equal(first.status, "granted");
  const second = capacity.reserve({
    tenantId: "tenant_b",
    userId: "user_b",
    workspaceId: "workspace_b",
    runId: "run_b",
    commandId: "cmd_b",
    resourceClass: "build",
    now,
    ttlMs: 1_000
  });
  assert.equal(second.status, "waiting_for_capacity");
  assert.throws(() => capacity.assertCanDispatch("build", undefined, now), /CapacityReservation/);
  capacity.assertCanDispatch("build", first.reservation?.id, now);
  capacity.release(first.reservation!.id, now + 100, "completed");
  assert.equal(capacity.activeReservations().length, 0);
});

test("critical overload blocks new heavy work but not lightweight admission", () => {
  const capacity = new CapacityAdmissionController();
  capacity.addOverloadSignal({
    source: "cpu",
    severity: "critical",
    observedMetric: 0.98,
    threshold: 0.9,
    recommendedAction: "drain",
    expiresAt: 5_000
  });
  assert.equal(
    capacity.reserve({
      tenantId: "tenant_a",
      userId: "user_a",
      workspaceId: "workspace_a",
      runId: "run_a",
      commandId: "cmd_build",
      resourceClass: "build",
      now: 1_000,
      ttlMs: 500
    }).status,
    "waiting_for_capacity"
  );
  assert.equal(
    capacity.reserve({
      tenantId: "tenant_a",
      userId: "user_a",
      workspaceId: "workspace_a",
      runId: "run_a",
      commandId: "cmd_light",
      resourceClass: "light",
      now: 1_000,
      ttlMs: 500
    }).status,
    "granted"
  );
});

test("tenant fair queue prevents one tenant from monopolizing dispatch order", () => {
  const queue = new TenantFairQueue();
  queue.enqueue({ id: "a1", tenantId: "a", userId: "u", workspaceId: "w", priority: 1, enqueueTime: 1 });
  queue.enqueue({ id: "a2", tenantId: "a", userId: "u", workspaceId: "w", priority: 1, enqueueTime: 2 });
  queue.enqueue({ id: "b1", tenantId: "b", userId: "u", workspaceId: "w", priority: 1, enqueueTime: 3 });
  assert.equal(queue.dequeue(10)?.id, "a1");
  assert.equal(queue.dequeue(10)?.id, "b1");
  assert.equal(queue.dequeue(10)?.id, "a2");
});

test("agent work cannot start without contract, active lease, and budget", () => {
  const core = new CoreControlPlane();
  assert.throws(() => core.startAgentWork(undefined, context), /AgentTaskContract/);
  const contract: AgentTaskContract = {
    id: "contract_1",
    parentRunId: "run_1",
    tenantId: "tenant_a",
    workspaceId: "workspace_1",
    repositoryId: "repo_1",
    branch: "main",
    objective: "Implement Core gate",
    allowedTools: ["fs", "test"],
    ownedFiles: ["packages/core-kernel/src/index.ts"],
    forbiddenFiles: [],
    workScope: { workspaceId: "workspace_1", rootPath: "/workspace", allowedPaths: ["/workspace/packages"] },
    commandBudget: 10,
    tokenBudget: 10_000,
    retryBudget: 2,
    wallClockBudgetMs: 60_000,
    resourceClass: "interactive",
    requiresCapacityReservation: true,
    dependencies: [],
    outputSchema: { type: "object" },
    verificationCommands: ["npm test"],
    escalationTriggers: ["scope-change"],
    cancellationToken: "cancel_1",
    heartbeatIntervalMs: 10_000,
    doneCriteria: ["tests pass"]
  };
  core.startAgentWork(contract, context);
  assert.throws(() => assertLeaseActive({ id: "lease_1", contractId: "contract_1", agentId: "agent_1", expiresAt: 1_000 }, 1_000), /expired/);
  const tracker = new AgentBudgetTracker(
    { commandLimit: 1, retryLimit: 0, toolExecutionLimit: 1, tokenLimit: 10, wallClockLimitMs: 1_000 },
    { commands: 0, retries: 0, toolExecutions: 0, tokens: 0, wallClockMs: 0 }
  );
  tracker.recordToolExecution(5);
  assert.throws(() => tracker.recordToolExecution(1), /tool execution limit/);
});

test("workspace WorkScope, FileLease, and code-server editor session gates are enforced", () => {
  const scope: WorkScope = {
    tenantId: "tenant_a",
    userId: "user_a",
    workspaceId: "workspace_a",
    rootPath: "/srv/workspaces/workspace_a",
    writablePaths: ["/srv/workspaces/workspace_a/src"]
  };
  const lease: FileLease = {
    id: "lease_file_1",
    tenantId: "tenant_a",
    workspaceId: "workspace_a",
    path: "/srv/workspaces/workspace_a/src/app.ts",
    ownerId: "agent_1",
    expiresAt: 2_000
  };
  assertWriteFileAllowed(scope, lease, "/srv/workspaces/workspace_a/src/app.ts", 1_000);
  assert.throws(() => assertWriteFileAllowed(scope, lease, "/etc/passwd", 1_000), /outside WorkScope/);
  assert.throws(() => assertWriteFileAllowed(scope, undefined, "/srv/workspaces/workspace_a/src/app.ts", 1_000), /FileLease/);
  assert.throws(
    () =>
      assertDedicatedCodeServer([
        { id: "cs_1", tenantId: "tenant_a", userId: "user_a", workspaceId: "workspace_a", containerId: "container_1", state: "ready" },
        { id: "cs_2", tenantId: "tenant_b", userId: "user_b", workspaceId: "workspace_b", containerId: "container_1", state: "ready" }
      ]),
    /Shared code-server/
  );
  const session = issueEditorSession({
    tenantId: "tenant_a",
    userId: "user_a",
    workspaceId: "workspace_a",
    codeServer: { id: "cs_1", tenantId: "tenant_a", userId: "user_a", workspaceId: "workspace_a", containerId: "container_1", state: "ready" },
    expiresAt: 2_000
  });
  assert.equal(session.publicRoute.startsWith("/editor/session/"), true);
  assert.equal(JSON.stringify(session).includes("container_1"), false);
  assertEditorSessionUsable(session, "tenant_a", "user_a", "workspace_a", 1_000);
  assert.throws(() => assertEditorSessionUsable(session, "tenant_b", "user_b", "workspace_a", 1_000), /mismatch/);
});
