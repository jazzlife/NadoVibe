import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  APP_SERVER_SESSION_TRANSITIONS,
  APPROVAL_TRANSITIONS,
  REQUIRED_DOMAIN_MODELS,
  WORKSPACE_RUNTIME_TRANSITIONS,
  assertSameTenantReferences,
  classifyFailure,
  rebuildPlatformReadModels,
  transitionDomainState,
  type DomainModelBase
} from "@nadovibe/domain";
import { CoreControlPlane, POSTGRES_EVENT_JOURNAL_DDL, type CoreCommandContext } from "@nadovibe/core-kernel";

const context: CoreCommandContext = {
  tenantId: "tenant_phase_02",
  userId: "user_phase_02",
  requestId: "req_phase_02",
  correlationId: "corr_phase_02",
  sourceService: "phase-02-test",
  actor: { type: "user", id: "user_phase_02" }
};

test("domain package implements every required phase 2 aggregate/entity name", () => {
  const required = [
    "Tenant",
    "User",
    "Membership",
    "Workspace",
    "Repository",
    "WorkspaceRuntime",
    "AppServerConnection",
    "AppServerSchemaVersion",
    "AppServerSession",
    "AppServerThread",
    "AppServerTurn",
    "AppServerItem",
    "AppServerNotificationOffset",
    "AppServerApprovalMirror",
    "AppServerRateLimitMirror",
    "Thread",
    "Run",
    "Agent",
    "AgentTaskContract",
    "AgentWorkItem",
    "AgentLease",
    "AgentBudget",
    "ResourcePool",
    "TenantQuota",
    "UserQuota",
    "WorkspaceQuota",
    "CapacityReservation",
    "RunQueueSlot",
    "CommandResourceClass",
    "OverloadSignal",
    "SupervisorDecision",
    "SupervisorCheckpoint",
    "WorkScope",
    "FileLease",
    "Command",
    "ApprovalRequest",
    "Conflict",
    "Integration",
    "Artifact",
    "Checkpoint",
    "Notification",
    "AuditEvent"
  ];
  assert.deepEqual([...REQUIRED_DOMAIN_MODELS].sort(), required.sort());
});

test("phase 2 state machines accept only explicit transitions", () => {
  assert.equal(transitionDomainState(APPROVAL_TRANSITIONS, "requested", "visible"), "visible");
  assert.throws(() => transitionDomainState(APPROVAL_TRANSITIONS, "approved", "visible"), /Invalid transition/);
  assert.equal(transitionDomainState(WORKSPACE_RUNTIME_TRANSITIONS, "busy", "capacity_blocked"), "capacity_blocked");
  assert.throws(() => transitionDomainState(APP_SERVER_SESSION_TRANSITIONS, "closed", "connected"), /Invalid transition/);
});

test("cross-tenant references are denied at domain boundary", () => {
  const base = (id: string, tenantId: string): DomainModelBase<"active"> => ({
    id,
    tenantId,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    actor: { type: "user", id: "user" },
    version: 1,
    lifecycleState: "active"
  });
  assert.doesNotThrow(() => assertSameTenantReferences(base("a", "tenant_a"), base("b", "tenant_a")));
  assert.throws(() => assertSameTenantReferences(base("a", "tenant_a"), base("b", "tenant_b")), /Cross-tenant/);
});

test("PostgreSQL event journal DDL encodes append-only concurrency and idempotency tables", () => {
  const migration = readFileSync(resolve("infra/db/001_core_event_journal.sql"), "utf8");
  for (const text of [POSTGRES_EVENT_JOURNAL_DDL, migration]) {
    assert.match(text, /CREATE TABLE IF NOT EXISTS core_events/);
    assert.match(text, /UNIQUE \(aggregate_id, aggregate_version\)/);
    assert.match(text, /CREATE TABLE IF NOT EXISTS core_command_idempotency/);
    assert.match(text, /payload JSONB NOT NULL/);
  }
});

test("projection rebuild produces timeline and agent roster from durable events", () => {
  const core = new CoreControlPlane();
  core.createRun({ idempotencyKey: "idem_projection", runId: "run_projection", workspaceId: "workspace_projection" }, context);
  core.transitionRun({ runId: "run_projection", to: "queued" }, context);
  core.startAgentWork(
    {
      id: "contract_projection",
      parentRunId: "run_projection",
      tenantId: "tenant_phase_02",
      workspaceId: "workspace_projection",
      repositoryId: "repo_projection",
      branch: "main",
      objective: "Build projection",
      allowedTools: ["test"],
      ownedFiles: ["packages/domain/src/index.ts"],
      forbiddenFiles: [],
      workScope: { workspaceId: "workspace_projection", rootPath: "/workspace", allowedPaths: ["/workspace/packages"] },
      commandBudget: 5,
      tokenBudget: 5000,
      retryBudget: 1,
      wallClockBudgetMs: 30000,
      resourceClass: "interactive",
      requiresCapacityReservation: false,
      dependencies: [],
      outputSchema: { type: "object" },
      verificationCommands: ["npm test"],
      escalationTriggers: ["scope"],
      cancellationToken: "cancel_projection",
      heartbeatIntervalMs: 10000,
      doneCriteria: ["projection rebuilt"]
    },
    context
  );
  const readModels = rebuildPlatformReadModels(core.events.readAll());
  assert.equal(readModels.timeline.some((item) => item.summary === "draft -> queued"), true);
  assert.equal(readModels.agentRoster[0]?.objective, "Build projection");
});

test("failure classification separates capacity, policy, runtime, and fatal causes", () => {
  assert.equal(classifyFailure("quota capacity exhausted"), "capacity_wait");
  assert.equal(classifyFailure("policy denied by approval gate"), "policy_denied");
  assert.equal(classifyFailure("runtime restart timeout"), "retryable_runtime");
  assert.equal(classifyFailure("corrupt invariant"), "fatal");
});
