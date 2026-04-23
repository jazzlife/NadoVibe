import http from "node:http";
import {
  assertNoAnonymousSandboxVolumes,
  assertWriteFileAllowed,
  blockDirectAppServerWorkspaceMethod,
  createArtifactMetadata,
  createCodeServerProcess,
  createSandboxContainerSpec,
  issueEditorSession,
  planRuntimeCommand,
  type FileLease,
  type ProvisionWorkspaceRequest,
  type RuntimeCommandRequest,
  type WorkScope,
  type WorkspaceCodeServerProcess
} from "@nadovibe/core-kernel";

const port = Number.parseInt(process.env.WORKSPACE_RUNTIME_PORT ?? "8093", 10);

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/healthz" || request.url === "/readyz") {
      sendJson(response, 200, { ok: true, service: "workspace-runtime", dependency: "core" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/write-policy/check") {
      const body = await readJson(request);
      const scope = body.workScope as WorkScope;
      const lease = body.fileLease as FileLease | undefined;
      const targetPath = String(body.path);
      assertWriteFileAllowed(scope, lease, targetPath, Date.now());
      sendJson(response, 200, { ok: true, routedThrough: "WorkScope/FileLease" });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/provision-plan") {
      const body = (await readJson(request)) as unknown as ProvisionWorkspaceRequest;
      const spec = createSandboxContainerSpec(body);
      assertNoAnonymousSandboxVolumes(spec);
      sendJson(response, 200, { spec, codeServer: createCodeServerProcess(spec) });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/command-plan") {
      const body = (await readJson(request)) as unknown as RuntimeCommandRequest;
      sendJson(response, 200, { plan: planRuntimeCommand(body, Date.now()) });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/app-server-method/check") {
      const body = await readJson(request);
      blockDirectAppServerWorkspaceMethod(String(body.method));
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/editor-session") {
      const body = await readJson(request);
      const codeServer = body.codeServer as WorkspaceCodeServerProcess;
      const session = issueEditorSession({
        tenantId: String(body.tenantId),
        userId: String(body.userId),
        workspaceId: String(body.workspaceId),
        codeServer,
        expiresAt: Number(body.expiresAt)
      });
      sendJson(response, 200, { session });
      return;
    }
    if (request.method === "POST" && request.url === "/v1/workspace/artifact") {
      const body = await readJson(request);
      sendJson(
        response,
        200,
        createArtifactMetadata({
          tenantId: String(body.tenantId),
          workspaceId: String(body.workspaceId),
          commandId: String(body.commandId),
          contentType: String(body.contentType),
          sizeBytes: Number(body.sizeBytes)
        })
      );
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "unknown_error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "workspace-runtime listening", port }) + "\n");
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
