import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOperationalAdminSnapshot,
  checkAppServerCompatibility,
  createBackupPlan,
  createBuildMetadata,
  createHostCapacitySampleFromOs,
  evaluateDockerHostPreflight,
  evaluateDrainModeAdmission,
  planServiceRollout,
  quarantineFailedRollout,
  routeCanaryVersion,
  runMigrationPlan,
  validateComposeEnvironment,
  validatePortainerStackOrder,
  validateQuotaProfile,
  validateRestoreDryRun,
  validateRollbackCompatibility,
  validateSandboxImageMetadata,
  type MigrationStep
} from "@nadovibe/core-operations";
import type { CapacityReservation, RunRecord, SandboxImageMetadata, WorkspaceEditorSession } from "@nadovibe/core-kernel";

test("phase 9 exposes service version metadata and operational admin metrics", () => {
  const metadata = createBuildMetadata("gateway", {
    NADOVIBE_ENV_PROFILE: "staging",
    NADOVIBE_IMAGE_TAG: "sha-abc",
    NADOVIBE_BUILD_VERSION: "0.1.0",
    NADOVIBE_GIT_SHA: "abc123",
    NADOVIBE_EVENT_SCHEMA_VERSION: "1",
    NADOVIBE_MIGRATION_VERSION: "3",
    APP_SERVER_PROTOCOL_VERSION: "official-docs-2026-04-23"
  });
  assert.equal(metadata.service, "gateway");
  assert.equal(metadata.envProfile, "staging");
  assert.equal(metadata.imageTag, "sha-abc");

  const reservations: CapacityReservation[] = [
    reservation("tenant_a", "build", "res_a"),
    reservation("tenant_a", "test", "res_b"),
    reservation("tenant_b", "long_running", "res_c")
  ];
  const snapshot = buildOperationalAdminSnapshot({
    services: ["gateway", "web", "orchestrator"],
    quotaProfile: "production",
    reservations,
    projectionLagEvents: 2,
    queueLagMs: 18
  });
  assert.equal(snapshot.versions.length, 3);
  assert.equal(snapshot.migrations.currentVersion, 3);
  assert.equal(snapshot.capacity.reservations, 3);
  assert.equal(snapshot.capacity.topTenantsByResourceUsage[0]?.tenantId, "tenant_a");
  assert.ok(snapshot.capacity.workerPoolSaturation.length >= 3);
});

test("phase 9 validates quota profiles, compose environment, stack order, and host preflight", () => {
  assert.equal(validateQuotaProfile("production").ok, true);
  assert.equal(validatePortainerStackOrder().ok, true);
  assert.equal(validatePortainerStackOrder(["clients-stack", "core-stack"]).ok, false);
  assert.equal(validateComposeEnvironment("production", {
    NADOVIBE_ENV_PROFILE: "production",
    NADOVIBE_IMAGE_TAG: "local",
    POSTGRES_PASSWORD: "change-me-in-portainer-secret"
  }).ok, false);
  assert.equal(validateComposeEnvironment("production", {
    NADOVIBE_ENV_PROFILE: "production",
    NADOVIBE_IMAGE_TAG: "2026.04.23-abc123",
    POSTGRES_PASSWORD: "use-portainer-secret-value",
    SYSBASE_ENABLED: "false"
  }).ok, true);
  const preflight = evaluateDockerHostPreflight(createHostCapacitySampleFromOs({
    cpuCores: 16,
    memoryMb: 65536,
    diskFreeMb: 524288,
    inodeFreePercent: 25,
    pidsMax: 65536,
    networkMtu: 1500,
    volumeWriteMbSec: 200,
    logRotation: { driver: "local", maxSizeMb: 100 }
  }), "production");
  assert.equal(preflight.ok, true);
  assert.equal(preflight.checks.length, 8);
});

test("phase 9 blocks incompatible app-server protocol and unsafe active rollout", () => {
  assert.equal(checkAppServerCompatibility({
    protocolVersion: "official-docs-2026-04-23",
    platformVersion: "0.1.0"
  }).compatible, true);
  const incompatible = checkAppServerCompatibility({
    protocolVersion: "future-protocol",
    platformVersion: "0.1.0",
    methods: ["initialize", "future/mutate"]
  });
  assert.equal(incompatible.compatible, false);
  assert.ok(incompatible.missingMethodPolicies.includes("future/mutate"));

  const running: RunRecord = { id: "run_active", tenantId: "tenant_a", workspaceId: "workspace_a", state: "running", version: 7 };
  const blocked = planServiceRollout({
    service: "app-server-adapter",
    targetVersion: "0.1.1",
    stableVersion: "0.1.0",
    profile: "staging",
    activeRuns: [running],
    now: 10
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.state, "draining");
  assert.match(blocked.reasons.join("\n"), /active run drain/);

  const session: WorkspaceEditorSession = {
    id: "editor_a",
    tenantId: "tenant_a",
    userId: "user_a",
    workspaceId: "workspace_a",
    codeServerProcessId: "cs_a",
    publicRoute: "/editor/session/editor_a",
    expiresAt: 100
  };
  const workspacePlan = planServiceRollout({
    service: "workspace-runtime",
    targetVersion: "0.1.1",
    stableVersion: "0.1.0",
    profile: "staging",
    activeRuns: [],
    editorSessions: [session],
    now: 10
  });
  assert.equal(workspacePlan.allowed, false);
  assert.match(workspacePlan.steps.join("\n"), /reissue|revoke/);
});

test("phase 9 drain mode, sandbox image, migration, backup, rollback, canary, and quarantine policies are enforceable", () => {
  assert.equal(evaluateDrainModeAdmission({ drainMode: true, workload: "heavy_command" }).admitted, false);
  assert.equal(evaluateDrainModeAdmission({ drainMode: true, workload: "recovery" }).admitted, true);

  const sandbox: SandboxImageMetadata = {
    image: "nadovibe/sandbox:0.1.0",
    version: "0.1.0",
    codeServerVersion: "4.96.4",
    extensionAllowlist: ["ms-vscode.vscode-typescript-next", "esbenp.prettier-vscode"],
    healthcheckCommand: ["curl", "-fsS", "http://127.0.0.1:8080/healthz"]
  };
  assert.equal(validateSandboxImageMetadata(sandbox).ok, true);
  assert.equal(validateSandboxImageMetadata({ ...sandbox, extensionAllowlist: ["*"] }).ok, false);

  const destructive: MigrationStep = {
    version: 4,
    name: "destructive_test",
    kind: "database",
    destructive: true,
    forwardOnly: true,
    requiresBackup: true,
    apply: (state) => ({ ...state, databaseVersion: 4, applied: [...state.applied, "destructive_test"] })
  };
  assert.throws(() => runMigrationPlan({ currentVersion: 3, targetVersion: 4, migrations: [destructive] }), /backup/);
  assert.equal(runMigrationPlan({ currentVersion: 3, targetVersion: 4, backupSnapshotId: "backup_1", migrations: [destructive] }).state.databaseVersion, 4);

  const backup = createBackupPlan({ profile: "production", volumeRoot: "/var/lib/nadovibe", snapshotId: "backup_1" });
  assert.equal(backup.requiresQuiesce, true);
  assert.equal(validateRestoreDryRun({
    backup,
    eventCountBefore: 10,
    eventCountAfter: 10,
    projectionCountBefore: 3,
    projectionCountAfter: 3,
    artifactCountBefore: 2,
    artifactCountAfter: 2
  }).ok, true);
  assert.equal(validateRollbackCompatibility({
    currentEventSchemaVersion: 2,
    rollbackReadableEventSchemaVersion: 1,
    destructiveMigrationApplied: false
  }).ok, false);
  assert.equal(routeCanaryVersion({ tenantId: "tenant_canary", stableVersion: "0.1.0", canaryVersion: "0.1.1", canaryTenantIds: ["tenant_canary"] }), "0.1.1");
  assert.equal(routeCanaryVersion({ tenantId: "tenant_stable", stableVersion: "0.1.0", canaryVersion: "0.1.1", canaryTenantIds: ["tenant_canary"] }), "0.1.0");
  assert.equal(quarantineFailedRollout({
    rolloutId: "rollout_1",
    service: "gateway",
    failedVersion: "0.1.1",
    rollbackVersion: "0.1.0",
    reason: "health verification failed",
    now: new Date("2026-04-23T00:00:00.000Z")
  }).state, "quarantined");
});

function reservation(tenantId: string, resourceClass: CapacityReservation["resourceClass"], id: string): CapacityReservation {
  return {
    id,
    tenantId,
    userId: `${tenantId}_user`,
    workspaceId: `${tenantId}_workspace`,
    runId: `${tenantId}_run`,
    commandId: `${tenantId}_command`,
    resourceClass,
    grantedUnits: 1,
    expiresAt: Date.now() + 60_000
  };
}
