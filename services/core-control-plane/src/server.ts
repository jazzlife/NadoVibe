import http from "node:http";
import { CoreControlPlane, createOfficialDocsSchemaArtifact, AppServerSchemaRegistry } from "@nadovibe/core-kernel";

const port = Number.parseInt(process.env.CORE_CONTROL_PLANE_PORT ?? "8081", 10);
const core = new CoreControlPlane();
const registry = new AppServerSchemaRegistry();
registry.register(createOfficialDocsSchemaArtifact());

const server = http.createServer((request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (request.url === "/healthz") {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, service: "core-control-plane" }));
    return;
  }
  if (request.url === "/readyz") {
    registry.requireCurrent("official-docs-2026-04-23");
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, eventCount: core.events.readAll().length }));
    return;
  }
  response.writeHead(404);
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "core-control-plane listening", port }) + "\n");
});
