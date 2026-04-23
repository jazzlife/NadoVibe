import path from "node:path";
import { isHeavyResourceClass, type CapacityReservation, type ResourceClass } from "@nadovibe/core-resource";

export interface WorkScope {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly rootPath: string;
  readonly writablePaths: readonly string[];
}

export interface FileLease {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly path: string;
  readonly ownerId: string;
  readonly expiresAt: number;
  readonly releasedAt?: number;
}

export interface WorkspaceCommandPolicyRequest {
  readonly cwd: string;
  readonly resourceClass: string;
  readonly workScope: WorkScope;
  readonly fileLease?: FileLease;
}

export interface WorkspaceCodeServerProcess {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly containerId: string;
  readonly state: "starting" | "ready" | "recovering" | "stopped" | "failed";
}

export interface WorkspaceEditorSession {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly codeServerProcessId: string;
  readonly publicRoute: string;
  readonly expiresAt: number;
  readonly revokedAt?: number;
}

export interface SandboxImageMetadata {
  readonly image: string;
  readonly version: string;
  readonly codeServerVersion: string;
  readonly extensionAllowlist: readonly string[];
  readonly healthcheckCommand: readonly string[];
}

export interface SandboxResourceLimits {
  readonly cpus: number;
  readonly memoryMb: number;
  readonly pidsLimit: number;
  readonly diskMb: number;
  readonly logMaxSize: string;
}

export interface SandboxContainerSpec {
  readonly name: string;
  readonly image: SandboxImageMetadata;
  readonly labels: Record<string, string>;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly networkName: string;
  readonly volumes: readonly string[];
  readonly limits: SandboxResourceLimits;
  readonly codeServer: {
    readonly bindHost: "127.0.0.1";
    readonly port: number;
    readonly userDataDir: string;
    readonly extensionsDir: string;
    readonly cacheDir: string;
  };
}

export interface ProvisionWorkspaceRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly image: SandboxImageMetadata;
  readonly reservation?: CapacityReservation;
  readonly limits: SandboxResourceLimits;
}

export interface RuntimeCommandRequest {
  readonly commandId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly cwd: string;
  readonly command: readonly string[];
  readonly env: Record<string, string>;
  readonly resourceClass: ResourceClass;
  readonly maxRuntimeMs: number;
  readonly outputLimitBytes: number;
  readonly workScope: WorkScope;
  readonly capacityReservation?: CapacityReservation;
}

export interface RuntimeCommandPlan {
  readonly commandId: string;
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly resourceClass: ResourceClass;
  readonly timeoutMs: number;
  readonly outputLimitBytes: number;
  readonly redactedEnv: Record<string, string>;
}

export interface ArtifactMetadata {
  readonly artifactId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly commandId: string;
  readonly uri: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface EditorSessionIssueRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly codeServer: WorkspaceCodeServerProcess;
  readonly expiresAt: number;
}

export class WorkspacePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspacePolicyError";
  }
}

export function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = path.resolve(parent);
  const resolvedChild = path.resolve(child);
  const relative = path.relative(resolvedParent, resolvedChild);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertPathWithinWorkScope(scope: WorkScope, targetPath: string): void {
  const allowedRoots = [scope.rootPath, ...scope.writablePaths];
  if (!allowedRoots.some((allowedRoot) => isPathInside(allowedRoot, targetPath))) {
    throw new WorkspacePolicyError(`Path is outside WorkScope: ${targetPath}`);
  }
}

export function assertFileLeaseActive(scope: WorkScope, lease: FileLease | undefined, targetPath: string, now: number): void {
  if (!lease) {
    throw new WorkspacePolicyError("FileLease is required for file mutation");
  }
  if (lease.tenantId !== scope.tenantId || lease.workspaceId !== scope.workspaceId) {
    throw new WorkspacePolicyError("FileLease does not belong to WorkScope");
  }
  if (lease.releasedAt !== undefined || lease.expiresAt <= now) {
    throw new WorkspacePolicyError("FileLease is not active");
  }
  if (!isPathInside(lease.path, targetPath) && path.resolve(lease.path) !== path.resolve(targetPath)) {
    throw new WorkspacePolicyError("FileLease does not cover target path");
  }
}

export function assertWorkspaceCommandAllowed(request: WorkspaceCommandPolicyRequest): void {
  assertPathWithinWorkScope(request.workScope, request.cwd);
}

export function assertWriteFileAllowed(scope: WorkScope, lease: FileLease | undefined, targetPath: string, now: number): void {
  assertPathWithinWorkScope(scope, targetPath);
  assertFileLeaseActive(scope, lease, targetPath, now);
}

export function assertDedicatedCodeServer(processes: readonly WorkspaceCodeServerProcess[]): void {
  const seen = new Set<string>();
  for (const process of processes) {
    const key = `${process.tenantId}:${process.userId}:${process.workspaceId}`;
    if (seen.has(key)) {
      throw new WorkspacePolicyError(`Duplicate code-server process for ${key}`);
    }
    seen.add(key);
  }
  const processByContainer = new Map<string, WorkspaceCodeServerProcess>();
  for (const process of processes) {
    const existing = processByContainer.get(process.containerId);
    if (existing && (existing.tenantId !== process.tenantId || existing.userId !== process.userId || existing.workspaceId !== process.workspaceId)) {
      throw new WorkspacePolicyError("Shared code-server container across tenant/user/workspace is denied");
    }
    processByContainer.set(process.containerId, process);
  }
}

export function issueEditorSession(request: EditorSessionIssueRequest): WorkspaceEditorSession {
  if (
    request.codeServer.tenantId !== request.tenantId ||
    request.codeServer.userId !== request.userId ||
    request.codeServer.workspaceId !== request.workspaceId
  ) {
    throw new WorkspacePolicyError("Cannot issue editor session for another tenant/user/workspace");
  }
  if (request.codeServer.state !== "ready") {
    throw new WorkspacePolicyError("code-server process is not ready");
  }
  const id = `editor_${request.tenantId}_${request.userId}_${request.workspaceId}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    tenantId: request.tenantId,
    userId: request.userId,
    workspaceId: request.workspaceId,
    codeServerProcessId: request.codeServer.id,
    publicRoute: `/editor/session/${id}`,
    expiresAt: request.expiresAt
  };
}

export function assertEditorSessionUsable(session: WorkspaceEditorSession, tenantId: string, userId: string, workspaceId: string, now: number): void {
  if (session.tenantId !== tenantId || session.userId !== userId || session.workspaceId !== workspaceId) {
    throw new WorkspacePolicyError("Editor session tenant/user/workspace mismatch");
  }
  if (session.revokedAt !== undefined || session.expiresAt <= now) {
    throw new WorkspacePolicyError("Editor session is expired or revoked");
  }
}

export function createSandboxContainerSpec(request: ProvisionWorkspaceRequest): SandboxContainerSpec {
  if (!request.reservation || request.reservation.releasedAt !== undefined) {
    throw new WorkspacePolicyError("Sandbox provision requires active CapacityReservation");
  }
  if (
    request.reservation.tenantId !== request.tenantId ||
    request.reservation.userId !== request.userId ||
    request.reservation.workspaceId !== request.workspaceId ||
    request.reservation.runId !== request.runId
  ) {
    throw new WorkspacePolicyError("CapacityReservation does not match sandbox provision identity");
  }
  const safeWorkspace = request.workspaceId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const safeUser = request.userId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return {
    name: `nv-${request.tenantId}-${safeUser}-${safeWorkspace}`,
    image: request.image,
    tenantId: request.tenantId,
    userId: request.userId,
    workspaceId: request.workspaceId,
    runId: request.runId,
    networkName: `nv-net-${request.tenantId}-${safeWorkspace}`,
    labels: {
      "com.nadovibe.tenant": request.tenantId,
      "com.nadovibe.user": request.userId,
      "com.nadovibe.workspace": request.workspaceId,
      "com.nadovibe.run": request.runId,
      "com.nadovibe.managed-by": "workspace-runtime"
    },
    volumes: [
      `nadovibe_repo_${safeWorkspace}:/workspace/repository:rw`,
      `nadovibe_workspace_${safeWorkspace}:/workspace:rw`,
      `nadovibe_codeserver_${safeUser}_${safeWorkspace}:/home/coder/.local/share/code-server:rw`,
      `nadovibe_artifacts_${safeWorkspace}:/artifacts:rw`
    ],
    limits: request.limits,
    codeServer: {
      bindHost: "127.0.0.1",
      port: 8080,
      userDataDir: "/home/coder/.local/share/code-server",
      extensionsDir: "/home/coder/.local/share/code-server/extensions",
      cacheDir: "/home/coder/.cache/code-server"
    }
  };
}

export function assertNoAnonymousSandboxVolumes(spec: SandboxContainerSpec): void {
  for (const volume of spec.volumes) {
    const [source, target] = volume.split(":");
    if (!source || !target || source.startsWith("/") || source.startsWith(".")) {
      throw new WorkspacePolicyError(`Sandbox volume must be named and explicit: ${volume}`);
    }
  }
}

export function createCodeServerProcess(spec: SandboxContainerSpec): WorkspaceCodeServerProcess {
  return {
    id: `cs_${spec.tenantId}_${spec.userId}_${spec.workspaceId}`,
    tenantId: spec.tenantId,
    userId: spec.userId,
    workspaceId: spec.workspaceId,
    containerId: spec.name,
    state: "starting"
  };
}

export function planRuntimeCommand(request: RuntimeCommandRequest, now: number): RuntimeCommandPlan {
  assertPathWithinWorkScope(request.workScope, request.cwd);
  if (request.command.length === 0 || request.command[0]?.trim() === "") {
    throw new WorkspacePolicyError("Runtime command argv is required");
  }
  if (request.maxRuntimeMs <= 0 || request.outputLimitBytes <= 0) {
    throw new WorkspacePolicyError("Runtime command requires timeout and output budget");
  }
  if (isHeavyResourceClass(request.resourceClass)) {
    const reservation = request.capacityReservation;
    if (
      !reservation ||
      reservation.releasedAt !== undefined ||
      reservation.expiresAt <= now ||
      reservation.tenantId !== request.tenantId ||
      reservation.userId !== request.userId ||
      reservation.workspaceId !== request.workspaceId ||
      reservation.commandId !== request.commandId ||
      reservation.resourceClass !== request.resourceClass
    ) {
      throw new WorkspacePolicyError("Heavy runtime command requires matching active CapacityReservation");
    }
  }
  return {
    commandId: request.commandId,
    cwd: path.resolve(request.cwd),
    argv: request.command,
    resourceClass: request.resourceClass,
    timeoutMs: request.maxRuntimeMs,
    outputLimitBytes: request.outputLimitBytes,
    redactedEnv: redactEnv(request.env)
  };
}

export function blockDirectAppServerWorkspaceMethod(method: string): void {
  if (method === "thread/shellCommand") {
    throw new WorkspacePolicyError("app-server thread/shellCommand is not exposed by Workspace Runtime");
  }
  if (method.startsWith("command/exec") || method.startsWith("fs/")) {
    throw new WorkspacePolicyError("app-server workspace side-effect must be converted to Core Workspace Runtime operation");
  }
}

export function createArtifactMetadata(input: Omit<ArtifactMetadata, "artifactId" | "uri">): ArtifactMetadata {
  const artifactId = `artifact_${input.tenantId}_${input.workspaceId}_${input.commandId}`;
  return {
    ...input,
    artifactId,
    uri: `/artifacts/${input.tenantId}/${input.workspaceId}/${artifactId}`
  };
}

function redactEnv(env: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    redacted[key] = /token|password|secret|credential|authorization/i.test(key) ? "[REDACTED]" : value;
  }
  return redacted;
}
