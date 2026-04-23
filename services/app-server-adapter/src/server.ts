import http from "node:http";
import {
  APP_SERVER_CLIENT_INFO,
  APP_SERVER_THREAD_SERVICE_NAME,
  AppServerSchemaRegistry,
  classifyAppServerMethod,
  createOfficialDocsSchemaArtifact,
  createRetrySchedule,
  normalizeAppServerNotification,
  normalizeApprovalRequest
} from "@nadovibe/core-kernel";

const port = Number.parseInt(process.env.APP_SERVER_ADAPTER_PORT ?? "8091", 10);
const registry = new AppServerSchemaRegistry();
registry.register(createOfficialDocsSchemaArtifact());

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz" || request.url === "/readyz") {
      registry.requireCurrent("official-docs-2026-04-23");
      sendJson(response, 200, { ok: true, service: "app-server-adapter", dependency: "core" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/app-server/method-policy") {
      const body = await readJson(request);
      const method = typeof body === "object" && body !== null && "method" in body ? String(body.method) : "";
      sendJson(response, 200, { policy: classifyAppServerMethod(method) });
      return;
    }
    if (request.method === "GET" && request.url === "/v1/app-server/metadata") {
      sendJson(response, 200, {
        clientInfo: APP_SERVER_CLIENT_INFO,
        serviceName: APP_SERVER_THREAD_SERVICE_NAME,
        credentialExposed: false
      });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/app-server/normalize-event") {
      const body = await readJson(request);
      sendJson(
        response,
        200,
        normalizeAppServerNotification({
          tenantId: String(body.tenantId),
          runId: String(body.runId),
          method: String(body.method),
          payload: body.payload
        })
      );
      return;
    }
    if (request.method === "POST" && request.url === "/v1/app-server/approval-request") {
      const body = await readJson(request);
      const payload = typeof body.payload === "object" && body.payload !== null ? (body.payload as Record<string, unknown>) : {};
      sendJson(response, 200, normalizeApprovalRequest({ tenantId: String(body.tenantId), runId: String(body.runId), payload }));
      return;
    }
    if (request.method === "POST" && request.url === "/v1/app-server/retry-schedule") {
      const body = await readJson(request);
      const attempt = Number(body.attempt ?? 0);
      sendJson(response, 200, { delayMs: createRetrySchedule(attempt) });
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "app-server-adapter listening", port }) + "\n");
});

async function readJson(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
