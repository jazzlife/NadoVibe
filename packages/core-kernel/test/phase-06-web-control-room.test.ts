import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicResponseSafe,
  parseEnqueueCommandRequest,
  rebuildControlRoomProjection,
  renderGeneratedGatewayBrowserClient,
  type FileTreeItem
} from "@nadovibe/api-contract";
import { CoreControlPlane, type CoreCommandContext } from "@nadovibe/core-kernel";
import { renderControlRoomHtml, renderShellCss } from "@nadovibe/ui";

const context: CoreCommandContext = {
  tenantId: "tenant_phase_06",
  userId: "user_phase_06",
  requestId: "req_phase_06",
  correlationId: "corr_phase_06",
  sourceService: "gateway",
  actor: { type: "user", id: "user_phase_06" }
};

test("phase 6 projection exposes Control Room surfaces without public resource jargon", () => {
  const core = new CoreControlPlane();
  core.createRun({ idempotencyKey: "run_phase_06", runId: "run_phase_06", workspaceId: "workspace_phase_06" }, context);
  core.transitionRun({ runId: "run_phase_06", to: "queued" }, context);
  core.transitionRun({ runId: "run_phase_06", to: "waiting_for_capacity" }, context);
  append(core, "workspace_phase_06", "Workspace", "WorkspaceCatalogSeeded", {
    workspaceId: "workspace_phase_06",
    workspaceName: "Phase 06 Workspace",
    repositoryId: "repo_phase_06",
    repositoryName: "NadoVibe",
    branch: "main"
  });
  append(core, "approval_phase_06", "ApprovalRequest", "ApprovalRequested", {
    approvalId: "approval_phase_06",
    runId: "run_phase_06",
    reason: "검토가 필요합니다.",
    state: "requested",
    destructive: false
  });
  append(core, "cmd_phase_06", "Command", "CommandQueued", {
    commandId: "cmd_phase_06",
    runId: "run_phase_06",
    instruction: "테스트를 실행합니다.",
    state: "preparing",
    resourceIntent: "test"
  });

  const fileTree: readonly FileTreeItem[] = [{ path: "apps/web/src/server.ts", name: "server.ts", type: "file", depth: 2 }];
  const userProjection = rebuildControlRoomProjection(core.events.readAll(), { role: "user", fileTree });
  assert.equal(userProjection.workspaces.length, 1);
  assert.equal(userProjection.runs[0]?.userStatus, "preparing");
  assert.equal(userProjection.approvalInbox[0]?.state, "requested");
  assert.equal(userProjection.commandQueue[0]?.state, "preparing");
  assert.equal(userProjection.fileTree[0]?.path, "apps/web/src/server.ts");
  assert.equal(userProjection.serviceHealth.some((item) => item.operatorOnly), false);
  assertPublicResponseSafe(userProjection);
  assert.doesNotMatch(JSON.stringify(userProjection), /quota|capacity|waiting_for_capacity|backpressure|overload|queue position/i);

  const operatorProjection = rebuildControlRoomProjection(core.events.readAll(), { role: "operator", fileTree });
  assert.equal(operatorProjection.serviceHealth.some((item) => item.operatorOnly), true);
});

test("web shell includes required IDE control surface regions and responsive constraints", () => {
  const html = renderControlRoomHtml();
  const css = renderShellCss();
  for (const id of [
    "workspaceSelect",
    "runForm",
    "lifecycleRail",
    "agentHierarchy",
    "supervisorDecisions",
    "commandQueue",
    "approvalInbox",
    "editorSession",
    "fileTree",
    "diffInspector",
    "terminalOutput",
    "finalReviewGate"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="skip-link" href="#mainControlSurface"/);
  assert.match(html, /<main id="mainControlSurface" class="ide-grid">/);
  assert.match(css, /grid-template-columns: var\(--rail-width\) minmax\(0, 1fr\) var\(--inspector-width\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(html + css, /landing|marketing/i);
});

test("phase 6 implementation keeps the Control Room design token contract", () => {
  const css = renderShellCss();
  const html = renderControlRoomHtml();

  for (const value of ["#EEF2EC", "#111827", "#22A06B", "292px", "430px"]) {
    assert.match(css, new RegExp(value.replace("#", "\\#")));
  }
  assert.match(html, /Skip to control surface/);
});

test("generated Gateway browser client covers phase 6 mutations and realtime reconnect entrypoint", () => {
  const script = renderGeneratedGatewayBrowserClient("http://127.0.0.1:8080");
  for (const route of [
    "/api/control-room",
    "/api/runs",
    "/api/commands",
    "/api/approvals/decision",
    "/api/supervisor/control",
    "/api/conflicts/escalate",
    "/api/editor-session",
    "/api/final-review",
    "/api/stream"
  ]) {
    assert.match(script, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(script, /EventSource/);
});

test("command request parser rejects malformed command payloads", () => {
  assert.throws(() => parseEnqueueCommandRequest({ runId: "run", instruction: "x", resourceIntent: "unsafe", idempotencyKey: "idem" }), /resourceIntent/);
  assert.deepEqual(parseEnqueueCommandRequest({ runId: "run", instruction: "x", resourceIntent: "test", idempotencyKey: "idem" }), {
    runId: "run",
    instruction: "x",
    resourceIntent: "test",
    idempotencyKey: "idem"
  });
});

function append(core: CoreControlPlane, aggregateId: string, aggregateType: string, type: string, payload: unknown): void {
  core.events.append({ aggregateId, aggregateType, type, schemaVersion: 1, payload, metadata: context }, core.events.readAggregate(aggregateId).at(-1)?.aggregateVersion ?? 0);
}
