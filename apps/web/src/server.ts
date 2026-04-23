import http from "node:http";
import { build } from "esbuild";
import { renderGeneratedGatewayBrowserClient } from "@nadovibe/api-contract";
import {
  renderControlRoomAppJs,
  renderControlRoomHtml,
  renderManifest,
  renderMobileCommandReviewAppJs,
  renderMobileCommandReviewHtml,
  renderServiceWorker,
  renderTabletWorkbenchAppJs,
  renderTabletWorkbenchHtml
} from "@nadovibe/ui";

const port = Number.parseInt(process.env.WEB_PORT ?? "5173", 10);
const gatewayBaseUrl = process.env.GATEWAY_BASE_URL ?? "http://127.0.0.1:8080";
let codeMirrorVendorCache: Promise<string> | undefined;

const server = http.createServer(async (request, response) => {
  if (request.url === "/healthz" || request.url === "/readyz") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, service: "web", dependency: "static" }));
    return;
  }
  if (request.url === "/workbench") {
    send(response, 200, "text/html; charset=utf-8", renderTabletWorkbenchHtml());
    return;
  }
  if (request.url === "/mobile") {
    send(response, 200, "text/html; charset=utf-8", renderMobileCommandReviewHtml());
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
  if (request.url === "/assets/workbench.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderTabletWorkbenchAppJs());
    return;
  }
  if (request.url === "/assets/mobile-command-review.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderMobileCommandReviewAppJs());
    return;
  }
  if (request.url === "/assets/codemirror-vendor.js") {
    send(response, 200, "text/javascript; charset=utf-8", await renderCodeMirrorVendorJs());
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

function renderCodeMirrorVendorJs(): Promise<string> {
  codeMirrorVendorCache ??= build({
    stdin: {
      contents: `
        import { EditorState } from "@codemirror/state";
        import { EditorView } from "@codemirror/view";
        import { basicSetup } from "codemirror";
        import { javascript } from "@codemirror/lang-javascript";
        export { EditorState, EditorView, basicSetup, javascript };
      `,
      resolveDir: process.cwd(),
      loader: "js"
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    logLevel: "silent"
  }).then((result) => result.outputFiles[0]?.text ?? "");
  return codeMirrorVendorCache;
}
