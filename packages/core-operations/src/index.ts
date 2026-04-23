import os from "node:os";
import type {
  CapacityQuota,
  CapacityReservation,
  GeneratedAppServerSchemaArtifact,
  OverloadSignal,
  ResourceClass,
  RunRecord,
  RunState,
  SandboxImageMetadata,
  WorkspaceEditorSession
} from "@nadovibe/core-kernel";
import { OFFICIAL_DOC_METHODS, validateMethodPolicyCoverage } from "@nadovibe/core-kernel";

export type EnvironmentProfile = "local" | "staging" | "production";
export type PlatformServiceName =
  | "core-control-plane"
  | "app-server-adapter"
  | "orchestrator"
  | "workspace-runtime"
  | "projection-worker"
  | "gateway"
  | "web"
  | "ops-health"
  | "sandbox-image";
export type ValidationSeverity = "error" | "warning";
export type RolloutState = "ready" | "blocked" | "draining" | "quarantined";
export type WorkloadKind = "light_command" | "heavy_command" | "sandbox_provision" | "approval" | "cancel" | "recovery" | "read_only";

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface BuildMetadata {
  readonly service: PlatformServiceName;
  readonly platformVersion: string;
  readonly imageTag: string;
  readonly gitSha: string;
  readonly builtAt: string;
  readonly envProfile: EnvironmentProfile;
  readonly eventSchemaVersion: number;
  readonly migrationVersion: number;
  readonly appServerProtocolVersion: string;
}

export interface QuotaProfile {
  readonly profile: EnvironmentProfile;
  readonly global: CapacityQuota;
  readonly tenantDefault: CapacityQuota;
  readonly userDefault: CapacityQuota;
  readonly workspaceDefault: CapacityQuota;
}

export interface StackDefinition {
  readonly name: string;
  readonly file: string;
  readonly purpose: string;
  readonly dependsOn: readonly string[];
  readonly services: readonly PlatformServiceName[];
}

export interface HostCapacitySample {
  readonly cpuCores: number;
  readonly memoryMb: number;
  readonly diskFreeMb: number;
  readonly inodeFreePercent: number;
  readonly pidsMax: number;
  readonly networkMtu: number;
  readonly volumeWriteMbSec: number;
  readonly logRotation: {
    readonly driver: "json-file" | "local" | "journald" | "syslog";
    readonly maxSizeMb?: number;
  };
}

export interface HostCapacityCheck {
  readonly name: "cpu" | "memory" | "disk" | "inode" | "pids" | "network" | "volume_throughput" | "log_rotation";
  readonly ok: boolean;
  readonly observed: number | string;
  readonly threshold: number | string;
  readonly message: string;
}

export interface HostCapacityPreflightResult {
  readonly ok: boolean;
  readonly profile: EnvironmentProfile;
  readonly checks: readonly HostCapacityCheck[];
}

export interface RolloutLock {
  readonly id: string;
  readonly scope: "tenant" | "workspace";
  readonly scopeId: string;
  readonly service: PlatformServiceName;
  readonly targetVersion: string;
  readonly owner: string;
  readonly reason: string;
  readonly expiresAt: number;
}

export interface RolloutPlanRequest {
  readonly service: PlatformServiceName;
  readonly targetVersion: string;
  readonly stableVersion: string;
  readonly profile: EnvironmentProfile;
  readonly activeRuns: readonly RunRecord[];
  readonly locks?: readonly RolloutLock[];
  readonly editorSessions?: readonly WorkspaceEditorSession[];
  readonly sandboxImage?: SandboxImageMetadata;
  readonly canaryTenantIds?: readonly string[];
  readonly currentEventSchemaVersion?: number;
  readonly targetEventSchemaVersion?: number;
  readonly backupSnapshotId?: string;
  readonly now: number;
}

export interface RolloutPlan {
  readonly service: PlatformServiceName;
  readonly state: RolloutState;
  readonly allowed: boolean;
  readonly targetVersion: string;
  readonly stableVersion: string;
  readonly reasons: readonly string[];
  readonly steps: readonly string[];
  readonly canaryTenantIds: readonly string[];
}

export interface FailedRolloutRecord {
  readonly rolloutId: string;
  readonly service: PlatformServiceName;
  readonly failedVersion: string;
  readonly rollbackVersion: string;
  readonly state: "quarantined";
  readonly reason: string;
  readonly createdAt: string;
}

export interface MigrationStep {
  readonly version: number;
  readonly name: string;
  readonly kind: "database" | "event_schema" | "volume";
  readonly destructive: boolean;
  readonly forwardOnly: boolean;
  readonly requiresBackup: boolean;
  apply(state: MigrationState): MigrationState;
}

export interface MigrationState {
  readonly databaseVersion: number;
  readonly eventSchemaVersion: number;
  readonly applied: readonly string[];
  readonly audit: readonly string[];
}

export interface MigrationRunResult {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly state: MigrationState;
  readonly appliedSteps: readonly MigrationStep[];
}

export interface AppServerCompatibilityInput {
  readonly protocolVersion: string;
  readonly platformVersion: string;
  readonly methods?: readonly string[];
}

export interface AppServerCompatibilityResult {
  readonly compatible: boolean;
  readonly protocolVersion: string;
  readonly blockingReasons: readonly string[];
  readonly missingMethodPolicies: readonly string[];
}

export interface BackupPlan {
  readonly id: string;
  readonly profile: EnvironmentProfile;
  readonly volumeRoot: string;
  readonly volumes: readonly string[];
  readonly commands: readonly string[];
  readonly requiresQuiesce: boolean;
}

export interface RestoreDryRunInput {
  readonly backup: BackupPlan;
  readonly eventCountBefore: number;
  readonly eventCountAfter: number;
  readonly projectionCountBefore: number;
  readonly projectionCountAfter: number;
  readonly artifactCountBefore: number;
  readonly artifactCountAfter: number;
}

export interface WorkerPoolUsage {
  readonly service: PlatformServiceName;
  readonly resourceClass: ResourceClass;
  readonly active: number;
  readonly max: number;
}

export interface WorkerPoolSaturation {
  readonly service: PlatformServiceName;
  readonly resourceClass: ResourceClass;
  readonly active: number;
  readonly max: number;
  readonly saturation: number;
}

export interface TenantResourceUsage {
  readonly tenantId: string;
  readonly reservations: number;
  readonly heavyReservations: number;
}

export interface OperationalAdminSnapshot {
  readonly generatedAt: string;
  readonly versions: readonly BuildMetadata[];
  readonly migrations: {
    readonly currentVersion: number;
    readonly currentEventSchemaVersion: number;
    readonly forwardOnly: boolean;
  };
  readonly lags: {
    readonly projectionLagEvents: number;
    readonly queueLagMs: number;
  };
  readonly capacity: {
    readonly quotaProfile: EnvironmentProfile;
    readonly reservations: number;
    readonly overloadSignals: number;
    readonly workerPoolSaturation: readonly WorkerPoolSaturation[];
    readonly topTenantsByResourceUsage: readonly TenantResourceUsage[];
  };
}

export class OperationsPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationsPolicyError";
  }
}

export const PLATFORM_VERSION = "0.1.0";
export const CURRENT_EVENT_SCHEMA_VERSION = 1;
export const CURRENT_MIGRATION_VERSION = 3;
export const SUPPORTED_APP_SERVER_PROTOCOLS = ["official-docs-2026-04-23"] as const;
export const ACTIVE_RUN_DRAIN_STATES: readonly RunState[] = ["running", "waiting_for_approval", "integrating"];
export const LOCAL_VOLUME_SET = [
  "nadovibe_postgres_data",
  "nadovibe_nats_data",
  "nadovibe_event_journal",
  "nadovibe_object_store",
  "nadovibe_repositories",
  "nadovibe_workspaces",
  "nadovibe_app_server_state",
  "nadovibe_audit_logs",
  "nadovibe_backups"
] as const;

export const QUOTA_PROFILES: Readonly<Record<EnvironmentProfile, QuotaProfile>> = {
  local: {
    profile: "local",
    global: quota(6, { light: 12, interactive: 6, test: 2, build: 1, long_running: 1, high_mem: 1 }),
    tenantDefault: quota(4, { light: 8, interactive: 4, test: 2, build: 1, long_running: 1, high_mem: 1 }),
    userDefault: quota(3, { light: 6, interactive: 3, test: 1, build: 1, long_running: 1, high_mem: 1 }),
    workspaceDefault: quota(2, { light: 4, interactive: 2, test: 1, build: 1, long_running: 1, high_mem: 1 })
  },
  staging: {
    profile: "staging",
    global: quota(18, { light: 32, interactive: 14, test: 6, build: 4, long_running: 3, high_mem: 2 }),
    tenantDefault: quota(8, { light: 16, interactive: 6, test: 3, build: 2, long_running: 1, high_mem: 1 }),
    userDefault: quota(4, { light: 8, interactive: 3, test: 2, build: 1, long_running: 1, high_mem: 1 }),
    workspaceDefault: quota(3, { light: 6, interactive: 2, test: 1, build: 1, long_running: 1, high_mem: 1 })
  },
  production: {
    profile: "production",
    global: quota(64, { light: 128, interactive: 48, test: 20, build: 12, long_running: 8, high_mem: 6 }),
    tenantDefault: quota(14, { light: 28, interactive: 10, test: 5, build: 3, long_running: 2, high_mem: 2 }),
    userDefault: quota(6, { light: 12, interactive: 4, test: 2, build: 1, long_running: 1, high_mem: 1 }),
    workspaceDefault: quota(4, { light: 8, interactive: 3, test: 1, build: 1, long_running: 1, high_mem: 1 })
  }
};

export const PORTAINER_STACKS: readonly StackDefinition[] = [
  {
    name: "core-stack",
    file: "infra/portainer/core-stack/docker-compose.yml",
    purpose: "PostgreSQL, optional NATS, Core Control Plane, and durable platform volumes",
    dependsOn: [],
    services: ["core-control-plane"]
  },
  {
    name: "app-server-adapter-stack",
    file: "infra/portainer/app-server-adapter-stack/docker-compose.yml",
    purpose: "Codex app-server adapter and orchestrator runtime shells",
    dependsOn: ["core-stack"],
    services: ["app-server-adapter", "orchestrator"]
  },
  {
    name: "workspace-runtime-stack",
    file: "infra/portainer/workspace-runtime-stack/docker-compose.yml",
    purpose: "Workspace Runtime Tool Gateway and repository/workspace/artifact volumes",
    dependsOn: ["core-stack"],
    services: ["workspace-runtime"]
  },
  {
    name: "gateway-projection-stack",
    file: "infra/portainer/gateway-projection-stack/docker-compose.yml",
    purpose: "Public Gateway and Projection Worker",
    dependsOn: ["core-stack"],
    services: ["gateway", "projection-worker"]
  },
  {
    name: "clients-stack",
    file: "infra/portainer/clients-stack/docker-compose.yml",
    purpose: "Browser, tablet, and mobile clients",
    dependsOn: ["gateway-projection-stack"],
    services: ["web"]
  },
  {
    name: "ops-observability-stack",
    file: "infra/portainer/ops-observability-stack/docker-compose.yml",
    purpose: "Operational health surface and logs",
    dependsOn: ["core-stack", "app-server-adapter-stack", "workspace-runtime-stack", "gateway-projection-stack", "clients-stack"],
    services: ["ops-health"]
  }
];

export const DEFAULT_MIGRATIONS: readonly MigrationStep[] = [
  {
    version: 1,
    name: "baseline_event_journal",
    kind: "database",
    destructive: false,
    forwardOnly: true,
    requiresBackup: false,
    apply: (state) => ({
      databaseVersion: 1,
      eventSchemaVersion: Math.max(state.eventSchemaVersion, 1),
      applied: [...state.applied, "baseline_event_journal"],
      audit: [...state.audit, "database baseline is ready"]
    })
  },
  {
    version: 2,
    name: "app_server_protocol_metadata",
    kind: "event_schema",
    destructive: false,
    forwardOnly: true,
    requiresBackup: false,
    apply: (state) => ({
      databaseVersion: 2,
      eventSchemaVersion: Math.max(state.eventSchemaVersion, 1),
      applied: [...state.applied, "app_server_protocol_metadata"],
      audit: [...state.audit, "app-server protocol metadata is backward-compatible"]
    })
  },
  {
    version: 3,
    name: "operations_rollout_state",
    kind: "database",
    destructive: false,
    forwardOnly: true,
    requiresBackup: false,
    apply: (state) => ({
      databaseVersion: 3,
      eventSchemaVersion: Math.max(state.eventSchemaVersion, CURRENT_EVENT_SCHEMA_VERSION),
      applied: [...state.applied, "operations_rollout_state"],
      audit: [...state.audit, "rollout locks, quarantine, and backup catalog tables are ready"]
    })
  }
];

export function createBuildMetadata(service: PlatformServiceName, env: NodeJS.ProcessEnv = process.env, builtAt = new Date()): BuildMetadata {
  return {
    service,
    platformVersion: env.NADOVIBE_BUILD_VERSION ?? PLATFORM_VERSION,
    imageTag: env.NADOVIBE_IMAGE_TAG ?? env.npm_package_version ?? "local",
    gitSha: env.NADOVIBE_GIT_SHA ?? "local",
    builtAt: env.NADOVIBE_BUILT_AT ?? builtAt.toISOString(),
    envProfile: parseEnvironmentProfile(env.NADOVIBE_ENV_PROFILE),
    eventSchemaVersion: parsePositiveInteger(env.NADOVIBE_EVENT_SCHEMA_VERSION, CURRENT_EVENT_SCHEMA_VERSION),
    migrationVersion: parsePositiveInteger(env.NADOVIBE_MIGRATION_VERSION, CURRENT_MIGRATION_VERSION),
    appServerProtocolVersion: env.APP_SERVER_PROTOCOL_VERSION ?? SUPPORTED_APP_SERVER_PROTOCOLS[0]
  };
}

export function parseEnvironmentProfile(value: string | undefined): EnvironmentProfile {
  if (value === "staging" || value === "production") {
    return value;
  }
  return "local";
}

export function getQuotaProfile(profile: EnvironmentProfile): QuotaProfile {
  return QUOTA_PROFILES[profile];
}

export function validateQuotaProfile(profile: EnvironmentProfile | QuotaProfile): ValidationResult {
  const quotaProfile = typeof profile === "string" ? getQuotaProfile(profile) : profile;
  const issues: ValidationIssue[] = [];
  validateQuota("global", quotaProfile.global, issues);
  validateQuota("tenantDefault", quotaProfile.tenantDefault, issues);
  validateQuota("userDefault", quotaProfile.userDefault, issues);
  validateQuota("workspaceDefault", quotaProfile.workspaceDefault, issues);
  if (quotaProfile.profile === "production" && quotaProfile.global.maxByClass.build !== undefined && quotaProfile.global.maxByClass.build < 4) {
    issues.push({ severity: "error", code: "production_build_capacity_low", message: "production build quota must allow at least four concurrent build reservations" });
  }
  return result(issues);
}

export function validateComposeEnvironment(profile: EnvironmentProfile, env: Record<string, string | undefined>): ValidationResult {
  const issues: ValidationIssue[] = [...validateQuotaProfile(profile).issues];
  if (parseEnvironmentProfile(env.NADOVIBE_ENV_PROFILE) !== profile) {
    issues.push({ severity: "error", code: "profile_mismatch", message: "NADOVIBE_ENV_PROFILE must match the selected deployment profile" });
  }
  if (profile === "production") {
    if ((env.NADOVIBE_IMAGE_TAG ?? "local") === "local") {
      issues.push({ severity: "error", code: "production_image_tag_local", message: "production cannot deploy the local image tag" });
    }
    if (!env.POSTGRES_PASSWORD || /change-me|nadovibe_dev/i.test(env.POSTGRES_PASSWORD)) {
      issues.push({ severity: "error", code: "production_secret_default", message: "production PostgreSQL password must be supplied from Portainer secret configuration" });
    }
  }
  if (env.SYSBASE_ENABLED === "true" && env.SYSBASE_LICENSE_ACCEPTED !== "true") {
    issues.push({ severity: "error", code: "sysbase_license_unaccepted", message: "SYSBASE/SAP SQL Anywhere cannot be enabled without explicit license acceptance and procurement record" });
  }
  return result(issues);
}

export function validatePortainerStackOrder(order: readonly string[] = PORTAINER_STACKS.map((stack) => stack.name)): ValidationResult {
  const issues: ValidationIssue[] = [];
  const expectedNames = new Set(PORTAINER_STACKS.map((stack) => stack.name));
  for (const name of expectedNames) {
    if (!order.includes(name)) {
      issues.push({ severity: "error", code: "missing_stack", message: `Stack order is missing ${name}` });
    }
  }
  for (const stack of PORTAINER_STACKS) {
    const index = order.indexOf(stack.name);
    for (const dependency of stack.dependsOn) {
      const dependencyIndex = order.indexOf(dependency);
      if (dependencyIndex === -1 || index === -1 || dependencyIndex > index) {
        issues.push({ severity: "error", code: "stack_dependency_order", message: `${stack.name} must be deployed after ${dependency}` });
      }
    }
  }
  return result(issues);
}

export function createHostCapacitySampleFromOs(overrides: Partial<HostCapacitySample> = {}): HostCapacitySample {
  return {
    cpuCores: overrides.cpuCores ?? os.cpus().length,
    memoryMb: overrides.memoryMb ?? Math.floor(os.totalmem() / 1024 / 1024),
    diskFreeMb: overrides.diskFreeMb ?? 64 * 1024,
    inodeFreePercent: overrides.inodeFreePercent ?? 20,
    pidsMax: overrides.pidsMax ?? 4096,
    networkMtu: overrides.networkMtu ?? 1500,
    volumeWriteMbSec: overrides.volumeWriteMbSec ?? 80,
    logRotation: overrides.logRotation ?? { driver: "local", maxSizeMb: 100 }
  };
}

export function evaluateDockerHostPreflight(sample: HostCapacitySample, profile: EnvironmentProfile): HostCapacityPreflightResult {
  const threshold = profile === "production"
    ? { cpu: 16, memory: 32768, disk: 262144, inode: 10, pids: 32768, mtu: 1500, throughput: 120, logSize: 100 }
    : profile === "staging"
      ? { cpu: 8, memory: 16384, disk: 131072, inode: 10, pids: 16384, mtu: 1500, throughput: 80, logSize: 100 }
      : { cpu: 2, memory: 4096, disk: 20480, inode: 5, pids: 2048, mtu: 1400, throughput: 20, logSize: 100 };
  const checks: HostCapacityCheck[] = [
    check("cpu", sample.cpuCores, threshold.cpu, "CPU cores available for Core, workers, and sandbox scheduling"),
    check("memory", sample.memoryMb, threshold.memory, "memory budget covers platform and concurrent sandbox reservations"),
    check("disk", sample.diskFreeMb, threshold.disk, "local volume root has enough free disk for event journal, artifacts, and backup windows"),
    check("inode", sample.inodeFreePercent, threshold.inode, "local volume root has enough inode headroom"),
    check("pids", sample.pidsMax, threshold.pids, "Docker host pids limit can absorb sandbox and code-server process bursts"),
    check("network", sample.networkMtu, threshold.mtu, "Docker bridge/network MTU is usable for app-server and realtime traffic"),
    check("volume_throughput", sample.volumeWriteMbSec, threshold.throughput, "volume write throughput can sustain event journal and artifact writes"),
    {
      name: "log_rotation",
      ok: sample.logRotation.driver !== "json-file" || (sample.logRotation.maxSizeMb !== undefined && sample.logRotation.maxSizeMb <= threshold.logSize),
      observed: `${sample.logRotation.driver}:${sample.logRotation.maxSizeMb ?? "unbounded"}`,
      threshold: `max ${threshold.logSize}MB if json-file`,
      message: "Docker log rotation must prevent unbounded service log growth"
    }
  ];
  return { ok: checks.every((item) => item.ok), profile, checks };
}

export function evaluateDrainModeAdmission(input: { readonly drainMode: boolean; readonly workload: WorkloadKind }): { readonly admitted: boolean; readonly reason: string } {
  if (!input.drainMode) {
    return { admitted: true, reason: "normal admission" };
  }
  if (input.workload === "heavy_command" || input.workload === "sandbox_provision") {
    return { admitted: false, reason: "drain mode blocks new heavy workload and sandbox provision" };
  }
  return { admitted: true, reason: "drain mode allows approval, cancel, recovery, and read-only inspection" };
}

export function planServiceRollout(request: RolloutPlanRequest): RolloutPlan {
  const reasons: string[] = [];
  const steps = [
    "acquire tenant/workspace rollout locks",
    "verify service /version metadata",
    "run health verification",
    "release rollout locks after projection consistency check"
  ];
  const activeDrainRuns = request.activeRuns.filter((run) => ACTIVE_RUN_DRAIN_STATES.includes(run.state));
  const relevantLocks = (request.locks ?? []).filter((lock) => lock.expiresAt > request.now && lock.service === request.service);

  if (relevantLocks.length > 0) {
    reasons.push(`active rollout lock exists for ${relevantLocks.map((lock) => `${lock.scope}:${lock.scopeId}`).join(", ")}`);
  }
  if ((request.service === "app-server-adapter" || request.service === "orchestrator") && activeDrainRuns.length > 0) {
    reasons.push(`active run drain required before ${request.service} update`);
  }
  if (request.service === "workspace-runtime") {
    const activeSessions = (request.editorSessions ?? []).filter((session) => session.revokedAt === undefined && session.expiresAt > request.now);
    if (activeSessions.length > 0) {
      reasons.push("workspace-runtime update requires workspace drain or editor session reissue plan");
      steps.splice(1, 0, "drain active workspace commands", "reissue or revoke active editor sessions after code-server reconciliation");
    }
  }
  if (request.service === "sandbox-image" && request.sandboxImage) {
    const sandboxValidation = validateSandboxImageMetadata(request.sandboxImage);
    reasons.push(...sandboxValidation.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message));
    steps.splice(1, 0, "validate code-server version", "validate extension allowlist", "validate user-data/cache migration compatibility");
  }
  if ((request.targetEventSchemaVersion ?? CURRENT_EVENT_SCHEMA_VERSION) < (request.currentEventSchemaVersion ?? CURRENT_EVENT_SCHEMA_VERSION)) {
    reasons.push("event schema rollback must use forward recovery compatibility, not down migration");
  }
  if (request.profile === "production" && request.backupSnapshotId === undefined && request.service === "core-control-plane") {
    reasons.push("production core-control-plane rollout requires a fresh local volume backup snapshot");
  }

  const allowed = reasons.length === 0;
  const state: RolloutState = allowed ? "ready" : reasons.some((reason) => /drain|session/i.test(reason)) ? "draining" : "blocked";
  return {
    service: request.service,
    state,
    allowed,
    targetVersion: request.targetVersion,
    stableVersion: request.stableVersion,
    reasons,
    steps,
    canaryTenantIds: request.canaryTenantIds ?? []
  };
}

export function routeCanaryVersion(input: { readonly tenantId: string; readonly stableVersion: string; readonly canaryVersion: string; readonly canaryTenantIds: readonly string[] }): string {
  return input.canaryTenantIds.includes(input.tenantId) ? input.canaryVersion : input.stableVersion;
}

export function quarantineFailedRollout(input: {
  readonly rolloutId: string;
  readonly service: PlatformServiceName;
  readonly failedVersion: string;
  readonly rollbackVersion: string;
  readonly reason: string;
  readonly now?: Date;
}): FailedRolloutRecord {
  return {
    rolloutId: input.rolloutId,
    service: input.service,
    failedVersion: input.failedVersion,
    rollbackVersion: input.rollbackVersion,
    state: "quarantined",
    reason: input.reason,
    createdAt: (input.now ?? new Date()).toISOString()
  };
}

export function planMigrations(currentVersion: number, targetVersion: number, migrations: readonly MigrationStep[] = DEFAULT_MIGRATIONS): readonly MigrationStep[] {
  if (targetVersion < currentVersion) {
    throw new OperationsPolicyError("Migration runner is forward-only; use rollback compatibility and forward recovery instead of down migration");
  }
  return migrations.filter((step) => step.version > currentVersion && step.version <= targetVersion).sort((left, right) => left.version - right.version);
}

export function runMigrationPlan(input: {
  readonly currentVersion: number;
  readonly targetVersion: number;
  readonly backupSnapshotId?: string;
  readonly initialState?: MigrationState;
  readonly migrations?: readonly MigrationStep[];
}): MigrationRunResult {
  const steps = planMigrations(input.currentVersion, input.targetVersion, input.migrations ?? DEFAULT_MIGRATIONS);
  const destructive = steps.find((step) => step.destructive || step.requiresBackup);
  if (destructive && !input.backupSnapshotId) {
    throw new OperationsPolicyError(`Migration ${destructive.name} requires a local volume backup snapshot`);
  }
  let state = input.initialState ?? { databaseVersion: input.currentVersion, eventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION, applied: [], audit: [] };
  for (const step of steps) {
    state = step.apply(state);
  }
  return { fromVersion: input.currentVersion, toVersion: input.targetVersion, state, appliedSteps: steps };
}

export function migrateEventSchemaArtifact(artifact: GeneratedAppServerSchemaArtifact): GeneratedAppServerSchemaArtifact {
  const missing = validateMethodPolicyCoverage(artifact.methods);
  if (missing.length > 0) {
    throw new OperationsPolicyError(`Cannot migrate app-server schema artifact with unclassified methods: ${missing.join(", ")}`);
  }
  return { ...artifact, generatedAt: artifact.generatedAt };
}

export function checkAppServerCompatibility(input: AppServerCompatibilityInput): AppServerCompatibilityResult {
  const methods = input.methods ?? OFFICIAL_DOC_METHODS;
  const missingMethodPolicies = validateMethodPolicyCoverage(methods);
  const blockingReasons: string[] = [];
  if (!SUPPORTED_APP_SERVER_PROTOCOLS.includes(input.protocolVersion as (typeof SUPPORTED_APP_SERVER_PROTOCOLS)[number])) {
    blockingReasons.push(`unsupported app-server protocol version: ${input.protocolVersion}`);
  }
  if (missingMethodPolicies.length > 0) {
    blockingReasons.push(`unclassified app-server methods: ${missingMethodPolicies.join(", ")}`);
  }
  if (input.platformVersion.trim().length === 0) {
    blockingReasons.push("platform version is required for compatibility check");
  }
  return { compatible: blockingReasons.length === 0, protocolVersion: input.protocolVersion, blockingReasons, missingMethodPolicies };
}

export function validateSandboxImageMetadata(metadata: SandboxImageMetadata): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.test(metadata.codeServerVersion)) {
    issues.push({ severity: "error", code: "invalid_code_server_version", message: "sandbox image must pin a concrete code-server semver" });
  }
  if (metadata.extensionAllowlist.length === 0 || metadata.extensionAllowlist.some((extension) => extension === "*" || extension.trim().length === 0)) {
    issues.push({ severity: "error", code: "invalid_extension_allowlist", message: "sandbox extension allowlist must be explicit and non-empty" });
  }
  if (!metadata.healthcheckCommand.join(" ").includes("healthz")) {
    issues.push({ severity: "error", code: "missing_codeserver_healthcheck", message: "sandbox image healthcheck must verify code-server healthz" });
  }
  return result(issues);
}

export function validateRollbackCompatibility(input: {
  readonly currentEventSchemaVersion: number;
  readonly rollbackReadableEventSchemaVersion: number;
  readonly backupSnapshotId?: string;
  readonly destructiveMigrationApplied: boolean;
}): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (input.currentEventSchemaVersion > input.rollbackReadableEventSchemaVersion) {
    issues.push({ severity: "error", code: "event_schema_too_new_for_rollback", message: "rollback target cannot read the current event schema; forward recovery is required" });
  }
  if (input.destructiveMigrationApplied && !input.backupSnapshotId) {
    issues.push({ severity: "error", code: "missing_backup_for_destructive_rollback", message: "destructive migration rollback requires a local volume backup snapshot" });
  }
  return result(issues);
}

export function createBackupPlan(input: { readonly profile: EnvironmentProfile; readonly volumeRoot: string; readonly snapshotId?: string }): BackupPlan {
  const id = input.snapshotId ?? `backup_${input.profile}_${Date.now()}`;
  const volumes = LOCAL_VOLUME_SET.map((volume) => `${input.volumeRoot}/${volume}`);
  return {
    id,
    profile: input.profile,
    volumeRoot: input.volumeRoot,
    volumes,
    requiresQuiesce: input.profile === "production",
    commands: [
      "enter drain mode for new heavy workload",
      "flush event journal and projection offsets",
      `archive named volumes under ${input.volumeRoot}`,
      "verify backup manifest checksum"
    ]
  };
}

export function validateRestoreDryRun(input: RestoreDryRunInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (input.eventCountBefore !== input.eventCountAfter) {
    issues.push({ severity: "error", code: "event_count_mismatch", message: "event journal count changed after restore dry-run" });
  }
  if (input.projectionCountBefore !== input.projectionCountAfter) {
    issues.push({ severity: "error", code: "projection_count_mismatch", message: "projection read model count changed after restore dry-run" });
  }
  if (input.artifactCountBefore !== input.artifactCountAfter) {
    issues.push({ severity: "error", code: "artifact_count_mismatch", message: "artifact count changed after restore dry-run" });
  }
  if (input.backup.volumes.length === 0) {
    issues.push({ severity: "error", code: "empty_backup", message: "restore dry-run requires a non-empty backup volume manifest" });
  }
  return result(issues);
}

export function calculateTopTenantsByResourceUsage(reservations: readonly CapacityReservation[]): readonly TenantResourceUsage[] {
  const usage = new Map<string, TenantResourceUsage>();
  for (const reservation of reservations.filter((item) => item.releasedAt === undefined)) {
    const current = usage.get(reservation.tenantId) ?? { tenantId: reservation.tenantId, reservations: 0, heavyReservations: 0 };
    usage.set(reservation.tenantId, {
      tenantId: reservation.tenantId,
      reservations: current.reservations + 1,
      heavyReservations: current.heavyReservations + (reservation.resourceClass === "light" || reservation.resourceClass === "interactive" ? 0 : 1)
    });
  }
  return [...usage.values()].sort((left, right) => right.reservations - left.reservations || right.heavyReservations - left.heavyReservations).slice(0, 10);
}

export function calculateWorkerPoolSaturation(usages: readonly WorkerPoolUsage[]): readonly WorkerPoolSaturation[] {
  return usages.map((usage) => ({
    ...usage,
    saturation: usage.max <= 0 ? 1 : Number((usage.active / usage.max).toFixed(3))
  }));
}

export function buildOperationalAdminSnapshot(input: {
  readonly services?: readonly PlatformServiceName[];
  readonly quotaProfile?: EnvironmentProfile;
  readonly reservations?: readonly CapacityReservation[];
  readonly overloadSignals?: readonly OverloadSignal[];
  readonly workerPools?: readonly WorkerPoolUsage[];
  readonly projectionLagEvents?: number;
  readonly queueLagMs?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly now?: Date;
} = {}): OperationalAdminSnapshot {
  const services = input.services ?? ["core-control-plane", "app-server-adapter", "orchestrator", "workspace-runtime", "projection-worker", "gateway", "web"];
  const reservations = input.reservations ?? [];
  const workerPools = input.workerPools ?? [
    { service: "orchestrator", resourceClass: "test", active: reservations.filter((item) => item.resourceClass === "test" && item.releasedAt === undefined).length, max: getQuotaProfile(input.quotaProfile ?? "local").global.maxByClass.test ?? 1 },
    { service: "workspace-runtime", resourceClass: "build", active: reservations.filter((item) => item.resourceClass === "build" && item.releasedAt === undefined).length, max: getQuotaProfile(input.quotaProfile ?? "local").global.maxByClass.build ?? 1 },
    { service: "workspace-runtime", resourceClass: "long_running", active: reservations.filter((item) => item.resourceClass === "long_running" && item.releasedAt === undefined).length, max: getQuotaProfile(input.quotaProfile ?? "local").global.maxByClass.long_running ?? 1 }
  ];
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    versions: services.map((service) => createBuildMetadata(service, input.env)),
    migrations: {
      currentVersion: CURRENT_MIGRATION_VERSION,
      currentEventSchemaVersion: CURRENT_EVENT_SCHEMA_VERSION,
      forwardOnly: true
    },
    lags: {
      projectionLagEvents: input.projectionLagEvents ?? 0,
      queueLagMs: input.queueLagMs ?? 0
    },
    capacity: {
      quotaProfile: input.quotaProfile ?? "local",
      reservations: reservations.filter((item) => item.releasedAt === undefined).length,
      overloadSignals: input.overloadSignals?.length ?? 0,
      workerPoolSaturation: calculateWorkerPoolSaturation(workerPools),
      topTenantsByResourceUsage: calculateTopTenantsByResourceUsage(reservations)
    }
  };
}

function quota(maxConcurrent: number, maxByClass: Partial<Record<ResourceClass, number>>): CapacityQuota {
  return { maxConcurrent, maxByClass };
}

function validateQuota(label: string, quotaValue: CapacityQuota, issues: ValidationIssue[]): void {
  if (!Number.isInteger(quotaValue.maxConcurrent) || quotaValue.maxConcurrent <= 0) {
    issues.push({ severity: "error", code: `${label}_max_concurrent_invalid`, message: `${label}.maxConcurrent must be a positive integer` });
  }
  for (const [resourceClass, value] of Object.entries(quotaValue.maxByClass)) {
    if (!Number.isInteger(value) || value <= 0) {
      issues.push({ severity: "error", code: `${label}_${resourceClass}_invalid`, message: `${label}.maxByClass.${resourceClass} must be a positive integer` });
    }
  }
}

function result(issues: readonly ValidationIssue[]): ValidationResult {
  return { ok: !issues.some((issue) => issue.severity === "error"), issues };
}

function check(name: HostCapacityCheck["name"], observed: number, threshold: number, message: string): HostCapacityCheck {
  return { name, ok: observed >= threshold, observed, threshold, message };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
