import http from "node:http";
import type { DomainEvent } from "@nadovibe/core-kernel";
import { createBuildMetadata } from "@nadovibe/core-operations";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

const port = Number.parseInt(process.env.PROJECTION_WORKER_PORT ?? "8094", 10);
const coreControlPlaneUrl = (process.env.CORE_CONTROL_PLANE_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");
const buildMetadata = createBuildMetadata("projection-worker");

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz") {
      sendJson(response, 200, { ok: true, service: "projection-worker" });
      return;
    }
    if (request.url === "/readyz") {
      const coreReady = await readDependencyHealth(`${coreControlPlaneUrl}/readyz`);
      sendJson(response, coreReady.ok ? 200 : 503, { ok: coreReady.ok, service: "projection-worker", dependency: "core-control-plane", core: coreReady });
      return;
    }
    if (request.method === "GET" && request.url === "/version") {
      sendJson(response, 200, buildMetadata);
      return;
    }
    if (request.method === "POST" && request.url === "/v1/projections/rebuild") {
      const body = await readJson(request);
      const events = Array.isArray(body.events) ? (body.events as DomainEvent[]) : [];
      const readModels = rebuildPlatformReadModels(events);
      sendJson(response, 200, { ok: true, replayedEvents: events.length, readModels });
      return;
    }
    if (request.method === "GET" && request.url === "/v1/projections/read-models") {
      const events = await readCoreEvents();
      sendJson(response, 200, { ok: true, eventCount: events.length, readModels: rebuildPlatformReadModels(events) });
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "projection-worker listening", port }) + "\n");
});

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
}

async function readCoreEvents(): Promise<readonly DomainEvent[]> {
  const payload = await requestJson<{ readonly events: readonly DomainEvent[] }>("/v1/core/events");
  return payload.events;
}

async function readDependencyHealth(url: string): Promise<{ readonly ok: boolean; readonly status?: number; readonly error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "dependency_check_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${coreControlPlaneUrl}${path}`);
  const payload = (await response.json()) as TResponse | { readonly error?: string };
  if (!response.ok) {
    throw new Error(typeof (payload as { readonly error?: unknown }).error === "string" ? (payload as { readonly error: string }).error : "core request failed");
  }
  return payload as TResponse;
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
