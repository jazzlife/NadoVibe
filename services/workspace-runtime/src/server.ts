import http from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertNoAnonymousSandboxVolumes,
  assertWriteFileAllowed,
  blockDirectAppServerWorkspaceMethod,
  createArtifactMetadata,
  createCodeServerProcess,
  createSandboxContainerSpec,
  issueEditorSession,
  planRuntimeCommand,
  type FileLease,
  type ProvisionWorkspaceRequest,
  type RuntimeCommandRequest,
  type SandboxContainerSpec,
  type WorkScope,
  type WorkspaceCodeServerProcess
} from "@nadovibe/core-kernel";
import { createBuildMetadata } from "@nadovibe/core-operations";

const port = Number.parseInt(process.env.WORKSPACE_RUNTIME_PORT ?? "8093", 10);
const dockerEnabled = process.env.WORKSPACE_RUNTIME_DOCKER_ENABLED === "true";
const dockerSocketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const singleWorkspaceRoot = process.env.WORKSPACE_RUNTIME_SINGLE_WORKSPACE_ROOT ?? process.env.NADOVIBE_WORKSPACE_ROOT;
const workspaceBaseDir = process.env.WORKSPACE_RUNTIME_WORKSPACE_BASE_DIR ?? "/var/lib/nadovibe/workspaces";
const fileLeaseTtlMs = parsePositiveInteger(process.env.WORKSPACE_RUNTIME_FILE_LEASE_TTL_MS, 10 * 60_000);
const buildMetadata = createBuildMetadata("workspace-runtime");
const fileLeases = new Map<string, FileLease>();
let nextFileLeaseSequence = 1;

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz") {
      sendJson(response, 200, { ok: true, service: "workspace-runtime", dockerEnabled });
      return;
    }
    if (request.url === "/readyz") {
      const docker = dockerEnabled ? await dockerPing() : { ok: true, detail: "docker runtime disabled by environment" };
      sendJson(response, docker.ok ? 200 : 503, { ok: docker.ok, service: "workspace-runtime", dockerEnabled, docker });
      return;
    }
    if (request.method === "GET" && request.url === "/version") {
      sendJson(response, 200, buildMetadata);
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/v1/workspace/files/tree")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const workspaceId = requireQuery(url, "workspaceId");
      const requestedPath = url.searchParams.get("path") ?? "";
      sendJson(response, 200, { workspaceId, items: readFileTree(workspaceId, requestedPath) });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/v1/workspace/files/read")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const workspaceId = requireQuery(url, "workspaceId");
      const requestedPath = requireQuery(url, "path");
      const absolute = safeWorkspacePath(workspaceId, requestedPath);
      const stat = statSync(absolute);
      if (!stat.isFile() || stat.size > 160_000) {
        throw new Error("file is not readable through Workspace Runtime");
      }
      const lease = issueFileLease(workspaceId, absolute);
      sendJson(response, 200, { path: requestedPath, content: readFileSync(absolute, "utf8"), fileLeaseId: lease.id, leaseExpiresAt: lease.expiresAt });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/v1/workspace/search")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const workspaceId = requireQuery(url, "workspaceId");
      const query = url.searchParams.get("query") ?? "";
      const requestedPath = url.searchParams.get("path") ?? "";
      sendJson(response, 200, searchWorkspace(workspaceId, query, requestedPath));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/files/write") {
      const body = await readJson(request);
      const workspaceId = requireBodyString(body, "workspaceId");
      const requestedPath = requireBodyString(body, "path");
      const content = requireBodyString(body, "content");
      const fileLeaseId = requireBodyString(body, "fileLeaseId");
      const absolute = safeWorkspacePath(workspaceId, requestedPath);
      const lease = fileLeases.get(fileLeaseId);
      assertWriteFileAllowed(workScopeFor(workspaceId), lease, absolute, Date.now());
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, "utf8");
      fileLeases.delete(fileLeaseId);
      sendJson(response, 202, { ok: true, workspaceId, path: requestedPath, bytes: Buffer.byteLength(content, "utf8") });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/write-policy/check") {
      const body = await readJson(request);
      const scope = body.workScope as WorkScope;
      const lease = body.fileLease as FileLease | undefined;
      const targetPath = String(body.path);
      assertWriteFileAllowed(scope, lease, targetPath, Date.now());
      sendJson(response, 200, { ok: true, routedThrough: "WorkScope/FileLease" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/provision-plan") {
      const body = (await readJson(request)) as unknown as ProvisionWorkspaceRequest;
      const spec = createSandboxContainerSpec(body);
      assertNoAnonymousSandboxVolumes(spec);
      sendJson(response, 200, { spec, codeServer: createCodeServerProcess(spec) });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/provision") {
      const body = (await readJson(request)) as unknown as ProvisionWorkspaceRequest;
      const spec = createSandboxContainerSpec(body);
      assertNoAnonymousSandboxVolumes(spec);
      const codeServer = await provisionDockerSandbox(spec);
      sendJson(response, 202, { spec, codeServer });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/stop") {
      const body = await readJson(request);
      await stopDockerSandbox(String(body.containerId));
      sendJson(response, 202, { ok: true, containerId: String(body.containerId) });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/command-plan") {
      const body = (await readJson(request)) as unknown as RuntimeCommandRequest;
      sendJson(response, 200, { plan: planRuntimeCommand(body, Date.now()) });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/app-server-method/check") {
      const body = await readJson(request);
      blockDirectAppServerWorkspaceMethod(String(body.method));
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/editor-session") {
      const body = await readJson(request);
      const codeServer = body.codeServer as WorkspaceCodeServerProcess;
      const session = issueEditorSession({
        tenantId: String(body.tenantId),
        userId: String(body.userId),
        workspaceId: String(body.workspaceId),
        codeServer,
        expiresAt: Number(body.expiresAt)
      });
      sendJson(response, 200, { session });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/artifact") {
      const body = await readJson(request);
      sendJson(
        response,
        200,
        createArtifactMetadata({
          tenantId: String(body.tenantId),
          workspaceId: String(body.workspaceId),
          commandId: String(body.commandId),
          contentType: String(body.contentType),
          sizeBytes: Number(body.sizeBytes)
        })
      );
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "workspace-runtime listening", port }) + "\n");
});

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
}

function requireQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} query parameter is required`);
  }
  return value;
}

function requireBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function workspaceRootFor(workspaceId: string): string {
  if (singleWorkspaceRoot) {
    return path.resolve(singleWorkspaceRoot);
  }
  return path.resolve(workspaceBaseDir, sanitizePathSegment(workspaceId));
}

function safeWorkspacePath(workspaceId: string, requestedPath: string): string {
  const root = workspaceRootFor(workspaceId);
  const relative = path.normalize(requestedPath || ".").replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(root, relative);
  const inside = absolute === root || absolute.startsWith(root + path.sep);
  if (!inside) {
    throw new Error("path is outside workspace");
  }
  return absolute;
}

function workScopeFor(workspaceId: string): WorkScope {
  const root = workspaceRootFor(workspaceId);
  return {
    tenantId: "tenant_dev",
    userId: "user_dev",
    workspaceId,
    rootPath: root,
    writablePaths: [root]
  };
}

function readFileTree(workspaceId: string, requestedPath: string): readonly FileTreeItem[] {
  ensureWorkspaceRoot(workspaceId);
  const base = safeWorkspacePath(workspaceId, requestedPath);
  if (!existsSync(base)) return [];
  const items: FileTreeItem[] = [];
  walk(workspaceId, base, path.relative(workspaceRootFor(workspaceId), base), 0, items);
  return items.slice(0, 320);
}

function searchWorkspace(workspaceId: string, query: string, requestedPath: string): WorkspaceSearchResponse {
  ensureWorkspaceRoot(workspaceId);
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return { workspaceId, query, results: [] };
  }
  const base = safeWorkspacePath(workspaceId, requestedPath);
  if (!existsSync(base)) return { workspaceId, query, results: [] };
  const results: WorkspaceSearchResultItem[] = [];
  searchWalk(workspaceId, base, normalizedQuery, results);
  return { workspaceId, query, results: results.slice(0, 40) };
}

function ensureWorkspaceRoot(workspaceId: string): string {
  const root = workspaceRootFor(workspaceId);
  mkdirSync(root, { recursive: true });
  return root;
}

function issueFileLease(workspaceId: string, absolutePath: string): FileLease {
  const now = Date.now();
  pruneExpiredFileLeases(now);
  const relativePath = path.relative(workspaceRootFor(workspaceId), absolutePath).replace(/\\/g, "/");
  const lease: FileLease = {
    id: `lease_${now}_${nextFileLeaseSequence++}_${sanitizePathSegment(relativePath)}`,
    tenantId: "tenant_dev",
    workspaceId,
    path: absolutePath,
    ownerId: "user_dev",
    expiresAt: now + fileLeaseTtlMs
  };
  fileLeases.set(lease.id, lease);
  return lease;
}

function pruneExpiredFileLeases(now: number): void {
  for (const [id, lease] of fileLeases.entries()) {
    if (lease.releasedAt !== undefined || lease.expiresAt <= now) {
      fileLeases.delete(id);
    }
  }
}

function searchWalk(workspaceId: string, absolute: string, query: string, results: Array<{ path: string; line: number; preview: string }>, depth = 0): void {
  if (depth > 4 || results.length >= 40) return;
  const stat = statSync(absolute);
  const root = workspaceRootFor(workspaceId);
  if (stat.isFile()) {
    const relative = path.relative(root, absolute).replace(/\\/g, "/");
    if (relative.toLowerCase().includes(query)) {
      results.push({ path: relative, line: 1, preview: relative });
    }
    if (stat.size > 160_000 || !/\.(ts|tsx|js|jsx|json|md|txt|css|html|yml|yaml|mjs|cjs)$/.test(relative)) return;
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
    searchWalk(workspaceId, path.join(absolute, entry.name), query, results, depth + 1);
    if (results.length >= 40) return;
  }
}

function walk(workspaceId: string, absolute: string, relativePath: string, depth: number, items: FileTreeItem[]): void {
  if (depth > 2 || items.length >= 320) return;
  const entries = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => ![".git", "node_modules", "dist", "coverage", ".DS_Store"].includes(entry.name))
    .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))
    .slice(0, 80);
  for (const entry of entries) {
    const childAbsolute = path.join(absolute, entry.name);
    const childRelative = path.join(relativePath, entry.name).replace(/\\/g, "/").replace(/^\.\//, "");
    items.push({ path: childRelative, name: entry.name, type: entry.isDirectory() ? "directory" : "file", depth });
    if (entry.isDirectory()) {
      walk(workspaceId, childAbsolute, childRelative, depth + 1, items);
    }
  }
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

interface FileTreeItem {
  readonly path: string;
  readonly name: string;
  readonly type: "file" | "directory";
  readonly depth: number;
}

interface WorkspaceSearchResponse {
  readonly workspaceId: string;
  readonly query: string;
  readonly results: readonly WorkspaceSearchResultItem[];
}

interface WorkspaceSearchResultItem {
  readonly path: string;
  readonly line: number;
  readonly preview: string;
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function provisionDockerSandbox(spec: SandboxContainerSpec): Promise<WorkspaceCodeServerProcess> {
  assertDockerEnabled();
  await ensureDockerNetwork(spec.networkName);
  const existing = await findContainerByName(spec.name);
  if (!existing) {
    await dockerRequest("POST", `/containers/create?name=${encodeURIComponent(spec.name)}`, {
      Image: spec.image.image,
      Labels: spec.labels,
      WorkingDir: "/workspace",
      Env: [
        `NADOVIBE_TENANT_ID=${spec.tenantId}`,
        `NADOVIBE_USER_ID=${spec.userId}`,
        `NADOVIBE_WORKSPACE_ID=${spec.workspaceId}`,
        `NADOVIBE_RUN_ID=${spec.runId}`
      ],
      ExposedPorts: { "8080/tcp": {} },
      HostConfig: {
        Binds: spec.volumes,
        NetworkMode: spec.networkName,
        NanoCpus: Math.round(spec.limits.cpus * 1_000_000_000),
        Memory: spec.limits.memoryMb * 1024 * 1024,
        PidsLimit: spec.limits.pidsLimit,
        LogConfig: { Type: "json-file", Config: { "max-size": spec.limits.logMaxSize, "max-file": "3" } }
      }
    });
  }
  const container = await findContainerByName(spec.name);
  if (!container) {
    throw new Error(`sandbox container was not created: ${spec.name}`);
  }
  if (container.State !== "running") {
    await dockerRequest("POST", `/containers/${encodeURIComponent(container.Id)}/start`);
  }
  return { ...createCodeServerProcess(spec), containerId: container.Id, state: "starting" };
}

async function stopDockerSandbox(containerId: string): Promise<void> {
  assertDockerEnabled();
  if (!containerId || containerId === "undefined") {
    throw new Error("containerId is required");
  }
  await dockerRequest("POST", `/containers/${encodeURIComponent(containerId)}/stop?t=10`);
}

async function ensureDockerNetwork(name: string): Promise<void> {
  const networks = await dockerRequest<Array<{ readonly Name: string }>>("GET", "/networks");
  if (networks.some((network) => network.Name === name)) return;
  await dockerRequest("POST", "/networks/create", { Name: name, Driver: "bridge", CheckDuplicate: true });
}

async function findContainerByName(name: string): Promise<{ readonly Id: string; readonly State: string } | undefined> {
  const filters = encodeURIComponent(JSON.stringify({ name: [`^/${name}$`] }));
  const containers = await dockerRequest<Array<{ readonly Id: string; readonly Names: readonly string[]; readonly State: string }>>("GET", `/containers/json?all=true&filters=${filters}`);
  return containers.find((container) => container.Names.includes(`/${name}`));
}

async function dockerPing(): Promise<{ readonly ok: boolean; readonly detail: string }> {
  try {
    await dockerRequest("GET", "/_ping");
    return { ok: true, detail: dockerSocketPath };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "docker_unavailable" };
  }
}

async function dockerRequest<TResponse = unknown>(method: string, path: string, body?: unknown): Promise<TResponse> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const response = await new Promise<{ readonly statusCode: number; readonly text: string }>((resolve, reject) => {
    const request = http.request(
      {
        socketPath: dockerSocketPath,
        path,
        method,
        headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : undefined
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 500, text: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
  if (response.statusCode >= 400) {
    throw new Error(`docker ${method} ${path} failed: ${response.statusCode} ${response.text}`);
  }
  if (response.text.trim().length === 0 || response.text.trim() === "OK") {
    return {} as TResponse;
  }
  return JSON.parse(response.text) as TResponse;
}

function assertDockerEnabled(): void {
  if (!dockerEnabled) {
    throw new Error("Workspace Runtime Docker lifecycle is disabled");
  }
}
