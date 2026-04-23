import http from "node:http";
import {
  assertPublicResponseSafe,
  mapInternalRunStateToUserStatus,
  parseCreateRunRequest,
  parseDevIdentitySeedRequest,
  publicProjection,
  replayStreamFromOffset
} from "@nadovibe/api-contract";
import { CoreControlPlane, type CoreCommandContext } from "@nadovibe/core-kernel";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

const port = Number.parseInt(process.env.GATEWAY_PORT ?? "8080", 10);
const core = new CoreControlPlane();

const server = http.createServer(async (request, response) => {
  const requestId = request.headers["x-request-id"]?.toString() ?? `req_${Date.now()}`;
  try {
    if (request.url === "/healthz") {
      sendJson(response, 200, { ok: true, service: "gateway", dependency: "core", requestId });
      return;
    }
    if (request.url === "/readyz") {
      sendJson(response, 200, { ok: true, service: "gateway", dependency: "core", eventCount: core.events.readAll().length, requestId });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/dev/seed") {
      const body = parseDevIdentitySeedRequest(await readJson(request));
      const context = contextFromSeed(body.tenantId, body.userId, requestId);
      const seed = core.seedIdentity({ ...body, idempotencyKey: `seed:${body.tenantId}:${body.userId}:${body.workspaceId}`, membershipRole: "owner" }, context);
      log("info", "seeded identity through Core command API", { requestId, tenantId: seed.tenantId, workspaceId: seed.workspaceId });
      sendJson(response, 201, { seed });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const context = contextFromSeed("tenant_dev", "user_dev", requestId);
      const run = core.createRun(body, context);
      sendJson(response, 201, { run });
      return;
    }
    if (request.method === "POST" && request.url === "/api/runs") {
      const body = parseCreateRunRequest(await readJson(request));
      const context = contextFromSeed("tenant_dev", "user_dev", requestId);
      const run = core.createRun(body, context);
      const payload = { runId: run.id, status: mapInternalRunStateToUserStatus(run.state), requestId };
      assertPublicResponseSafe(payload);
      sendJson(response, 202, payload);
      return;
    }
    if (request.method === "GET" && request.url === "/api/projections") {
      const projection = publicProjection(rebuildPlatformReadModels(core.events.readAll()));
      assertPublicResponseSafe(projection);
      sendJson(response, 200, projection);
      return;
    }
    if (request.method === "GET" && request.url === "/api/admin/capacity") {
      const readModels = rebuildPlatformReadModels(core.events.readAll());
      sendJson(response, 200, { ...readModels.resources, queueDepth: 0 });
      return;
    }
    if (request.method === "GET" && request.url?.startsWith("/api/stream")) {
      const url = new URL(request.url, "http://127.0.0.1");
      const after = Number.parseInt(url.searchParams.get("after") ?? "0", 10);
      const frames = replayStreamFromOffset(core.events.readAll(), Number.isFinite(after) ? after : 0);
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      for (const frame of frames) {
        response.write(`id: ${frame.offset}\n`);
        response.write(`event: core_event\n`);
        response.write(`data: ${JSON.stringify(frame.event)}\n\n`);
      }
      response.end();
      return;
    }
    sendJson(response, 404, { error: "not_found", requestId });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error", requestId });
  }
});

server.listen(port, "0.0.0.0", () => {
  log("info", "gateway listening", { port });
});

function contextFromSeed(tenantId: string, userId: string, requestId: string): CoreCommandContext {
  return {
    tenantId,
    userId,
    requestId,
    correlationId: requestId,
    sourceService: "gateway",
    actor: { type: "user", id: userId }
  };
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function log(level: "info" | "error", msg: string, fields: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ level, msg, service: "gateway", ...fields }) + "\n");
}
