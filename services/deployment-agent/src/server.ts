import http from "node:http";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  SERVICE_SANDBOX_SPECS,
  createBuildMetadata,
  planMountedReleaseActivation,
  validateMountedReleaseManifest,
  validateServiceVersionObservations,
  type BuildMetadata,
  type MountedReleaseManifest,
  type MountedReleaseServiceSpec,
  type PlatformServiceName,
  type ServiceVersionObservation,
  type ValidationIssue
} from "@nadovibe/core-operations";

interface DockerContainerSummary {
  readonly Id: string;
  readonly Names?: readonly string[];
  readonly State?: string;
  readonly Labels?: Record<string, string>;
}

const port = Number.parseInt(process.env.DEPLOYMENT_AGENT_PORT ?? "8098", 10);
const dockerSocketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const runtimeRoot = process.env.NADOVIBE_RUNTIME_ROOT ?? "/data/docker_data/nadovibe/runtime";
const releasesDir = process.env.NADOVIBE_RELEASES_DIR ?? path.join(runtimeRoot, "releases");
const currentDir = process.env.NADOVIBE_CURRENT_RELEASE_DIR ?? path.join(runtimeRoot, "current");
const manifestFile = process.env.NADOVIBE_RELEASE_MANIFEST_FILE ?? "nadovibe.release.json";
const buildMetadata = createBuildMetadata("deployment-agent");

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true, service: "deployment-agent" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/version") {
      sendJson(response, 200, buildMetadata);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/deployments/current") {
      const manifest = readManifest(path.join(currentDir, manifestFile));
      const observations = await observeServices(manifest.services);
      sendJson(response, 200, {
        manifest,
        manifestValidation: validateMountedReleaseManifest(manifest),
        observations,
        versionValidation: validateServiceVersionObservations(manifest, observations)
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/deployments/plan") {
      const body = await readJson(request);
      const manifest = readReleaseManifestFromBody(body);
      const changedPaths = readChangedPaths(body);
      sendJson(response, 200, { plan: planMountedReleaseActivation({ manifest, changedPaths }) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/deployments/activate") {
      const body = await readJson(request);
      const releaseId = requireString(body, "releaseId");
      const changedPaths = readChangedPaths(body);
      const releaseDir = path.join(releasesDir, releaseId);
      const manifest = readManifest(path.join(releaseDir, manifestFile));
      if (manifest.releaseId !== releaseId) {
        throw new Error(`releaseId mismatch: request=${releaseId} manifest=${manifest.releaseId}`);
      }
      const plan = planMountedReleaseActivation({ manifest, changedPaths });
      if (!plan.allowed) {
        throw new Error(`release activation blocked: ${formatIssues(plan.issues)}`);
      }
      replaceDirectoryContents(releaseDir, currentDir);
      repairWorkspaceSymlinks(currentDir);
      const restarted: PlatformServiceName[] = [];
      for (const group of plan.restartGroups) {
        for (const service of group.services) {
          if (service === "deployment-agent") continue;
          await restartComposeService(service);
          restarted.push(service);
        }
        for (const service of group.services) {
          if (service === "deployment-agent") continue;
          await waitForServiceHealth(service);
        }
      }
      const observations = await observeServices(manifest.services);
      const versionValidation = validateServiceVersionObservations(manifest, observations);
      if (!versionValidation.ok) {
        throw new Error(`post-restart version validation failed: ${formatIssues(versionValidation.issues)}`);
      }
      writeFileSync(path.join(currentDir, ".nadovibe-active-release.json"), JSON.stringify({ releaseId, restarted, activatedAt: new Date().toISOString() }, null, 2));
      sendJson(response, 200, { ok: true, plan, restarted, observations, versionValidation });
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "deployment-agent listening", port, runtimeRoot }) + "\n");
});

function readReleaseManifestFromBody(body: Record<string, unknown>): MountedReleaseManifest {
  if (typeof body.releaseId === "string") {
    return readManifest(path.join(releasesDir, body.releaseId, manifestFile));
  }
  if (typeof body.manifest === "object" && body.manifest !== null) {
    return body.manifest as MountedReleaseManifest;
  }
  return readManifest(path.join(currentDir, manifestFile));
}

function readChangedPaths(body: Record<string, unknown>): readonly string[] {
  return Array.isArray(body.changedPaths) ? body.changedPaths.map((item) => String(item)) : [];
}

function readManifest(file: string): MountedReleaseManifest {
  return JSON.parse(readFileSync(file, "utf8")) as MountedReleaseManifest;
}

function replaceDirectoryContents(sourceDir: string, targetDir: string): void {
  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    throw new Error("sourceDir and targetDir must be different");
  }
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    rmSync(path.join(targetDir, entry.name), { recursive: true, force: true });
  }
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    cpSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), { recursive: true, dereference: false });
  }
}

function repairWorkspaceSymlinks(root: string): void {
  const scopeDir = path.join(root, "node_modules", "@nadovibe");
  rmSync(scopeDir, { recursive: true, force: true });
  mkdirSync(scopeDir, { recursive: true });
  for (const workspaceRoot of ["packages", "services", "apps"]) {
    const dir = path.join(root, workspaceRoot);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = path.join(dir, entry.name, "package.json");
      if (!existsSync(packageJsonPath)) continue;
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { readonly name?: string };
      if (typeof packageJson.name !== "string" || !packageJson.name.startsWith("@nadovibe/")) continue;
      const name = packageJson.name.slice("@nadovibe/".length);
      symlinkSync(path.relative(scopeDir, path.join(dir, entry.name)), path.join(scopeDir, name), "dir");
    }
  }
}

async function restartComposeService(service: PlatformServiceName): Promise<void> {
  const containers = await containersForService(service);
  if (containers.length === 0) {
    throw new Error(`no Docker Compose container found for ${service}`);
  }
  for (const container of containers) {
    await dockerRequest("POST", `/containers/${encodeURIComponent(container.Id)}/restart?t=10`);
  }
}

async function containersForService(service: PlatformServiceName): Promise<readonly DockerContainerSummary[]> {
  const filters = encodeURIComponent(JSON.stringify({ label: [`com.docker.compose.service=${service}`] }));
  return dockerRequest<readonly DockerContainerSummary[]>("GET", `/containers/json?all=true&filters=${filters}`);
}

async function waitForServiceHealth(service: PlatformServiceName): Promise<void> {
  const deadline = Date.now() + 60_000;
  let lastError = "not_checked";
  while (Date.now() < deadline) {
    try {
      const url = serviceUrl(service, "health");
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "health_check_failed";
    }
    await sleep(1000);
  }
  throw new Error(`${service} health check timed out: ${lastError}`);
}

async function observeServices(services: readonly MountedReleaseServiceSpec[]): Promise<readonly ServiceVersionObservation[]> {
  return Promise.all(services.filter((service) => service.service !== "deployment-agent").map((service) => observeService(service.service)));
}

async function observeService(service: PlatformServiceName): Promise<ServiceVersionObservation> {
  try {
    const response = await fetch(serviceUrl(service, "version"));
    const payload = (await response.json()) as BuildMetadata | { readonly error?: string };
    if (!response.ok) {
      return { service, ok: false, error: typeof (payload as { readonly error?: unknown }).error === "string" ? (payload as { readonly error: string }).error : `HTTP ${response.status}` };
    }
    const metadata = payload as BuildMetadata;
    return {
      service,
      ok: true,
      platformVersion: metadata.platformVersion,
      gitSha: metadata.gitSha,
      eventSchemaVersion: metadata.eventSchemaVersion,
      migrationVersion: metadata.migrationVersion,
      appServerProtocolVersion: metadata.appServerProtocolVersion
    };
  } catch (error) {
    return { service, ok: false, error: error instanceof Error ? error.message : "version_check_failed" };
  }
}

function serviceUrl(service: PlatformServiceName, kind: "health" | "version"): string {
  const envName = `NADOVIBE_${service.toUpperCase().replace(/-/g, "_")}_URL`;
  const base = process.env[envName] ?? defaultServiceUrl(service);
  const spec = SERVICE_SANDBOX_SPECS.find((item) => item.service === service);
  if (!spec) {
    throw new Error(`unknown service ${service}`);
  }
  return `${base.replace(/\/$/, "")}${kind === "health" ? spec.healthPath : spec.versionPath}`;
}

function defaultServiceUrl(service: PlatformServiceName): string {
  switch (service) {
    case "core-control-plane":
      return "http://core-control-plane:8081";
    case "app-server-adapter":
      return "http://app-server-adapter:8091";
    case "orchestrator":
      return "http://orchestrator:8092";
    case "workspace-runtime":
      return "http://workspace-runtime:8093";
    case "gateway":
      return "http://gateway:8080";
    case "projection-worker":
      return "http://projection-worker:8094";
    case "web":
      return "http://web:5173";
    case "ops-health":
      return "http://ops-health:8099";
    case "deployment-agent":
      return "http://deployment-agent:8098";
    default:
      throw new Error(`service URL is not defined for ${service}`);
  }
}

async function dockerRequest<TResponse = unknown>(method: string, requestPath: string, body?: unknown): Promise<TResponse> {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise<TResponse>((resolve, reject) => {
    const request = http.request(
      {
        socketPath: dockerSocketPath,
        path: requestPath,
        method,
        headers: payload ? { "content-type": "application/json", "content-length": payload.length } : undefined
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`docker ${method} ${requestPath} failed: ${response.statusCode} ${text}`));
            return;
          }
          resolve(text.length > 0 ? (JSON.parse(text) as TResponse) : ({} as TResponse));
        });
      }
    );
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
