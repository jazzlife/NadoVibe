import http from "node:http";
import { renderGeneratedGatewayBrowserClient } from "@nadovibe/api-contract";
import { renderControlRoomAppJs, renderControlRoomHtml, renderManifest, renderServiceWorker } from "@nadovibe/ui";

const port = Number.parseInt(process.env.WEB_PORT ?? "5173", 10);
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:8080";

const server = http.createServer((request, response) => {
  if (request.url === "/healthz" || request.url === "/readyz") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, service: "web", dependency: "static" }));
    return;
  }
  if (request.url === "/assets/gateway-client.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderGeneratedGatewayBrowserClient(gatewayBaseUrl));
    return;
  }
  if (request.url === "/assets/control-room.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderControlRoomAppJs());
    return;
  }
  if (request.url === "/manifest.webmanifest") {
    send(response, 200, "application/manifest+json; charset=utf-8", renderManifest());
    return;
  }
  if (request.url === "/service-worker.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderServiceWorker());
    return;
  }
  send(response, 200, "text/html; charset=utf-8", renderControlRoomHtml());
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "web listening", port, gatewayBaseUrl }) + "\n");
});

function send(response: http.ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}
