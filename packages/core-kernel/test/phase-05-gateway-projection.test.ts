import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertPublicResponseSafe,
  mapInternalRunStateToUserStatus,
  publicProjection,
  replayStreamFromOffset
} from "@nadovibe/api-contract";
import { CoreControlPlane, type CoreCommandContext } from "@nadovibe/core-kernel";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

const context: CoreCommandContext = {
  tenantId: "tenant_phase_05",
  userId: "user_phase_05",
  requestId: "req_phase_05",
  correlationId: "corr_phase_05",
  sourceService: "gateway",
  actor: { type: "user", id: "user_phase_05" }
};

test("public run status hides internal capacity state", () => {
  assert.equal(mapInternalRunStateToUserStatus("queued"), "accepted");
  assert.equal(mapInternalRunStateToUserStatus("waiting_for_capacity"), "preparing");
  assert.equal(mapInternalRunStateToUserStatus("waiting_for_approval"), "needs_review");
});

test("public projection strips admin resources and sanitizes internal terms", () => {
  const core = new CoreControlPlane();
  core.createRun({ idempotencyKey: "run_phase_05", runId: "run_phase_05", workspaceId: "workspace_phase_05" }, context);
  core.transitionRun({ runId: "run_phase_05", to: "queued" }, context);
  core.transitionRun({ runId: "run_phase_05", to: "waiting_for_capacity" }, context);
  const readModels = rebuildPlatformReadModels(core.events.readAll());
  const publicReadModel = publicProjection(readModels);
  assert.equal("resources" in publicReadModel.readModels, false);
  assertPublicResponseSafe(publicReadModel);
});

test("admin projection can expose capacity counters separately from public API", () => {
  const readModels = rebuildPlatformReadModels([
    {
      id: "evt_res",
      aggregateId: "res_1",
      aggregateType: "CapacityReservation",
      aggregateVersion: 1,
      type: "CapacityReservationGranted",
      schemaVersion: 1,
      payload: {},
      metadata: {
        tenantId: "tenant_phase_05",
        requestId: "req",
        correlationId: "corr",
        sourceService: "test",
        actor: { type: "system", id: "system" },
        timestamp: "2026-04-23T00:00:00.000Z"
      }
    }
  ]);
  assert.equal(readModels.resources.reservations, 1);
});

test("realtime stream replays events after durable offset", () => {
  const frames = replayStreamFromOffset(["a", "b", "c"], 1);
  assert.deepEqual(frames, [
    { offset: 2, event: "b" },
    { offset: 3, event: "c" }
  ]);
});

test("public response safety check catches forbidden internal terms and secret detail", () => {
  assert.throws(() => assertPublicResponseSafe({ state: "waiting_for_capacity" }), /Public response/);
  assert.throws(() => assertPublicResponseSafe({ token: "secret" }), /Public response/);
  assert.doesNotThrow(() => assertPublicResponseSafe({ state: "preparing" }));
});

test("gateway uses remote Core Control Plane instead of an in-process Core authority", () => {
  const source = readFileSync("apps/gateway/src/server.ts", "utf8");
  assert.match(source, /class CoreControlPlaneClient/);
  assert.match(source, /CORE_CONTROL_PLANE_URL/);
  assert.doesNotMatch(source, /new CoreControlPlane\(/);
});

test("gateway delegates workspace file access to Workspace Runtime", () => {
  const source = readFileSync("apps/gateway/src/server.ts", "utf8");
  assert.match(source, /class WorkspaceRuntimeClient/);
  assert.match(source, /WORKSPACE_RUNTIME_URL/);
  assert.doesNotMatch(source, /from "node:fs"/);
  assert.doesNotMatch(source, /assertWriteFileAllowed/);
});

test("core-control-plane does not depend on app-server protocol snapshots", () => {
  const source = readFileSync("services/core-control-plane/src/server.ts", "utf8");
  assert.doesNotMatch(source, /AppServerSchemaRegistry/);
  assert.doesNotMatch(source, /createOfficialDocsSchemaArtifact/);
});
