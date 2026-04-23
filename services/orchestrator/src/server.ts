import http from "node:http";
import { validateAgentTaskContract, type AgentTaskContract } from "@nadovibe/core-kernel";
import { createBuildMetadata } from "@nadovibe/core-operations";

const port = Number.parseInt(process.env.ORCHESTRATOR_PORT ?? "8092", 10);
const buildMetadata = createBuildMetadata("orchestrator");

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz" || request.url === "/readyz") {
      sendJson(response, 200, { ok: true, service: "orchestrator", dependency: "core" });
      return;
    }
    if (request.method === "GET" && request.url === "/version") {
      sendJson(response, 200, buildMetadata);
      return;
    }
    if (request.method === "POST" && request.url === "/v1/agent-contract/validate") {
      const contract = (await readJson(request)) as AgentTaskContract;
      validateAgentTaskContract(contract);
      sendJson(response, 200, { ok: true, acceptedThrough: "Core AgentTaskContract" });
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "orchestrator listening", port }) + "\n");
});

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
