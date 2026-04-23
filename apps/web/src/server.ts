import http from "node:http";
import { renderShellCss } from "@nadovibe/ui";

const port = Number.parseInt(process.env.WEB_PORT ?? "5173", 10);

const server = http.createServer((request, response) => {
  if (request.url === "/healthz" || request.url === "/readyz") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify({ ok: true, service: "web", dependency: "static" }));
    return;
  }
  send(response, 200, "text/html; charset=utf-8", renderShell());
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "web listening", port }) + "\n");
});

function renderShell(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NadoVibe Control Room</title>
  <style>${renderShellCss()}</style>
</head>
<body>
  <main class="shell">
    <aside class="pane rail">
      <div class="toolbar"><strong>NadoVibe</strong></div>
      <div class="content">
        <div class="row"><span>Workspace</span><span class="badge">dev</span></div>
        <div class="row"><span>Runs</span><span class="badge">0</span></div>
        <div class="row"><span>Approvals</span><span class="badge">0</span></div>
      </div>
    </aside>
    <section class="pane">
      <div class="toolbar"><button type="button">New Run</button><span class="badge">Core first</span></div>
      <div class="content">
        <div class="row"><strong>Agent timeline</strong><span class="badge">ready</span></div>
        <div class="row"><span>Supervisor decision log</span><span class="badge">durable</span></div>
        <div class="row"><span>Command queue</span><span class="badge">Core gated</span></div>
      </div>
    </section>
    <aside class="pane inspector">
      <div class="toolbar"><strong>Inspector</strong></div>
      <div class="content">
        <div class="row"><span>Diff</span><span class="badge">empty</span></div>
        <div class="row"><span>Tests</span><span class="badge">idle</span></div>
        <div class="row"><span>Editor session</span><span class="badge">not issued</span></div>
      </div>
    </aside>
  </main>
</body>
</html>`;
}

function send(response: http.ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}
