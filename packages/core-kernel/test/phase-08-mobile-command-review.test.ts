import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPublicResponseSafe,
  parseMobilePushRegistrationRequest,
  parseNotificationReadRequest,
  parseNotificationSettingsRequest,
  rebuildMobileCommandReviewProjection,
  renderGeneratedGatewayBrowserClient
} from "@nadovibe/api-contract";
import { CoreControlPlane, type CoreCommandContext } from "@nadovibe/core-kernel";
import { renderMobileCommandReviewAppJs, renderMobileCommandReviewCss, renderMobileCommandReviewHtml, renderServiceWorker } from "@nadovibe/ui";

const context: CoreCommandContext = {
  tenantId: "tenant_phase_08",
  userId: "user_phase_08",
  requestId: "req_phase_08",
  correlationId: "corr_phase_08",
  sourceService: "gateway",
  actor: { type: "user", id: "user_phase_08" }
};

test("phase 8 implementation defines the mobile command review contract", () => {
  const html = renderMobileCommandReviewHtml();
  const css = renderMobileCommandReviewCss();

  assert.match(html, /NadoVibe Mobile Command/);
  assert.match(css, /max-width: 480px/);
  assert.match(css, /grid-template-rows: auto auto minmax\(0, 1fr\) 72px/);
  assert.match(css, /width: 48px/);
  assert.match(css, /height: 48px/);
});

test("mobile command review projection prioritizes next actions without internal resource terms", () => {
  const core = new CoreControlPlane();
  core.createRun({ idempotencyKey: "run_phase_08", runId: "run_phase_08", workspaceId: "workspace_phase_08" }, context);
  core.transitionRun({ runId: "run_phase_08", to: "queued" }, context);
  core.transitionRun({ runId: "run_phase_08", to: "planning" }, context);
  append(core, "workspace_phase_08", "Workspace", "WorkspaceCatalogSeeded", {
    workspaceId: "workspace_phase_08",
    workspaceName: "Phase 08 Workspace",
    repositoryId: "repo_phase_08",
    repositoryName: "NadoVibe",
    branch: "main"
  });
  append(core, "approval_phase_08", "ApprovalRequest", "ApprovalRequested", {
    approvalId: "approval_phase_08",
    runId: "run_phase_08",
    reason: "모바일 승인 검토가 필요합니다.",
    state: "requested",
    destructive: false
  });
  append(core, "conflict_phase_08", "Conflict", "ConflictDetected", {
    conflictId: "conflict_phase_08",
    runId: "run_phase_08",
    files: ["apps/gateway/src/server.ts"],
    summary: "Gateway 변경 hunk 검토가 필요합니다.",
    state: "detected"
  });
  append(core, "recovery_phase_08", "Recovery", "RecoveryQueued", {
    recoveryId: "recovery_phase_08",
    runId: "run_phase_08",
    title: "Workspace reconnect retry",
    state: "ready_to_retry",
    nextAction: "Retry"
  });
  append(core, "diff_phase_08", "Diff", "DiffUpdated", {
    path: "apps/gateway/src/server.ts",
    additions: 12,
    deletions: 3,
    hunks: [{ hunkId: "hunk_phase_08", title: "Mobile API route", additions: 12, deletions: 3, state: "pending" }]
  });
  append(core, "notification_phase_08", "Notification", "NotificationRaised", {
    notificationId: "notification_phase_08",
    title: "승인 필요",
    body: "모바일에서 검토하십시오.",
    route: "/mobile#approval-approval_phase_08",
    unread: true
  });

  const projection = rebuildMobileCommandReviewProjection(core.events.readAll());
  assert.equal(projection.nextActions[0]?.kind, "approval");
  assert.equal(projection.diffSummary.fileCount, 1);
  assert.equal(projection.diffSummary.hunkCount, 1);
  assert.equal(projection.diffSummary.riskyFiles[0], "apps/gateway/src/server.ts");
  assert.equal(projection.inbox[0]?.unread, true);
  assertPublicResponseSafe(projection);
  assert.doesNotMatch(JSON.stringify(projection), /quota|capacity|waiting_for_capacity|backpressure|overload|queue position|password|token|container/i);
});

test("mobile shell includes required Phase 8 surfaces, push routing, and command guards", () => {
  const html = renderMobileCommandReviewHtml();
  const css = renderMobileCommandReviewCss();
  const js = renderMobileCommandReviewAppJs();
  const serviceWorker = renderServiceWorker();

  for (const id of [
    "mobileNextAction",
    "mobileInboxList",
    "mobileRunDetail",
    "mobileAgentRoster",
    "mobileApprovalReview",
    "mobileConflictReview",
    "mobileRecoveryDecision",
    "mobileQuickCommandForm",
    "mobileFinalReview",
    "mobileNotificationSettings",
    "mobileServiceStatus",
    "mobileConfirmSheet",
    "mobileDiffSummary",
    "registerPushButton"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /min-height: 48px/);
  assert.match(css, /max-width: 480px/);
  assert.match(js, /getMobileReview/);
  assert.match(js, /registerMobilePush/);
  assert.match(js, /openConfirm/);
  assert.match(js, /offline/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /push/);
  assert.match(serviceWorker, /\/mobile/);
  assert.doesNotMatch(html + js, /quota|capacity|waiting_for_capacity|backpressure|overload|queue position|password|token|container/i);
});

test("phase 8 mobile API parsers and generated client cover push, settings, read state, and review projection", () => {
  const client = renderGeneratedGatewayBrowserClient("http://127.0.0.1:8080");
  assert.match(client, /\/api\/mobile\/review/);
  assert.match(client, /\/api\/mobile\/push\/register/);
  assert.match(client, /\/api\/mobile\/notification-settings/);
  assert.match(client, /\/api\/mobile\/notifications\/read/);

  assert.deepEqual(parseMobilePushRegistrationRequest({
    workspaceId: "workspace_dev",
    permission: "granted",
    endpoint: "local-endpoint",
    routeOnClick: "/mobile#inbox",
    idempotencyKey: "idem"
  }), {
    workspaceId: "workspace_dev",
    permission: "granted",
    endpoint: "local-endpoint",
    routeOnClick: "/mobile#inbox",
    idempotencyKey: "idem"
  });
  assert.equal(parseNotificationSettingsRequest({
    workspaceId: "workspace_dev",
    enabled: true,
    approvals: true,
    recovery: true,
    finalReview: false,
    quietHeavyWork: true,
    idempotencyKey: "idem"
  }).quietHeavyWork, true);
  assert.equal(parseNotificationReadRequest({ notificationId: "n1", idempotencyKey: "idem" }).notificationId, "n1");
  assert.throws(() => parseMobilePushRegistrationRequest({ workspaceId: "workspace_dev", permission: "maybe", endpoint: "x", routeOnClick: "/mobile", idempotencyKey: "idem" }), /permission/);
});

function append(core: CoreControlPlane, aggregateId: string, aggregateType: string, type: string, payload: unknown): void {
  core.events.append({ aggregateId, aggregateType, type, schemaVersion: 1, payload, metadata: context }, core.events.readAggregate(aggregateId).at(-1)?.aggregateVersion ?? 0);
}
