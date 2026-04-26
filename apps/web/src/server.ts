import http from "node:http";
import { build } from "esbuild";
import { renderGeneratedGatewayBrowserClient } from "@nadovibe/api-contract";
import { createBuildMetadata } from "@nadovibe/core-operations";
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
const buildMetadata = createBuildMetadata("web");
let codeMirrorVendorCache: Promise<string> | undefined;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, service: "web", dependency: "static" }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/version") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(buildMetadata));
    return;
  }
  if (url.pathname === "/workbench") {
    send(response, 200, "text/html; charset=utf-8", renderTabletWorkbenchHtml(), noStoreHeaders());
    return;
  }
  if (url.pathname === "/" || url.pathname === "/mobile") {
    send(response, 200, "text/html; charset=utf-8", renderMobileCommandReviewHtml(), noStoreHeaders());
    return;
  }
  if (url.pathname === "/control-room") {
    send(response, 200, "text/html; charset=utf-8", renderControlRoomHtml(), noStoreHeaders());
    return;
  }
  if (url.pathname === "/assets/gateway-client.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderGeneratedGatewayBrowserClient(gatewayBaseUrl));
    return;
  }
  if (url.pathname === "/assets/control-room.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderControlRoomAppJs());
    return;
  }
  if (url.pathname === "/assets/workbench.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderTabletWorkbenchAppJs());
    return;
  }
  if (url.pathname === "/assets/mobile-command-review.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderMobileCommandReviewAppJs(), noStoreHeaders());
    return;
  }
  if (url.pathname === "/assets/codemirror-vendor.js") {
    send(response, 200, "text/javascript; charset=utf-8", await renderCodeMirrorVendorJs());
    return;
  }
  if (url.pathname === "/manifest.webmanifest") {
    send(response, 200, "application/manifest+json; charset=utf-8", renderManifest(), noStoreHeaders());
    return;
  }
  if (url.pathname === "/service-worker.js") {
    send(response, 200, "text/javascript; charset=utf-8", renderServiceWorker(), {
      ...noStoreHeaders(),
      "service-worker-allowed": "/"
    });
    return;
  }
  send(response, 200, "text/html; charset=utf-8", renderControlRoomHtml(), noStoreHeaders());
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "web listening", port, gatewayBaseUrl }) + "\n");
});

function send(response: http.ServerResponse, status: number, contentType: string, body: string, headers: Record<string, string> = {}): void {
  response.writeHead(status, { "content-type": contentType, ...headers });
  response.end(body);
}

function noStoreHeaders(): Record<string, string> {
  return {
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    pragma: "no-cache",
    expires: "0"
  };
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
