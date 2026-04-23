import http from "node:http";
import { CoreControlPlane, type DomainEvent } from "@nadovibe/core-kernel";
import { rebuildPlatformReadModels } from "@nadovibe/domain";

const port = Number.parseInt(process.env.PROJECTION_WORKER_PORT ?? "8094", 10);

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz" || request.url === "/readyz") {
      sendJson(response, 200, { ok: true, service: "projection-worker", dependency: "projection" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/projections/rebuild") {
      const body = await readJson(request);
      const events = Array.isArray(body.events) ? (body.events as DomainEvent[]) : [];
      const core = new CoreControlPlane();
      core.replay(events);
      const readModels = rebuildPlatformReadModels(events);
      sendJson(response, 200, { ok: true, replayedEvents: events.length, readModels });
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

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
