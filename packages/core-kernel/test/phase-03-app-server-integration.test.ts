import assert from "node:assert/strict";
import test from "node:test";
import {
  APP_SERVER_CLIENT_INFO,
  APP_SERVER_THREAD_SERVICE_NAME,
  AppServerSchemaRegistry,
  ProtocolError,
  TypedAppServerClient,
  classifyAppServerMethod,
  createDefaultAppServerCapabilityRegistry,
  createInitializeRequest,
  createOfficialDocsSchemaArtifact,
  createRetrySchedule,
  createThreadStartRequest,
  normalizeAppServerNotification,
  normalizeApprovalRequest,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type TypedAppServerTransport
} from "@nadovibe/core-kernel";

class MemoryTransport implements TypedAppServerTransport {
  readonly requests: JsonRpcRequest[] = [];
  readonly notifications: JsonRpcNotification[] = [];

  async request(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.requests.push(message);
    return { id: message.id, result: { ok: true } };
  }

  async notify(message: JsonRpcNotification): Promise<void> {
    this.notifications.push(message);
  }
}

test("initialize request carries product clientInfo and omits jsonrpc wire header", () => {
  const request = createInitializeRequest(1);
  assert.equal("jsonrpc" in request, false);
  assert.deepEqual((request.params as { clientInfo: unknown }).clientInfo, APP_SERVER_CLIENT_INFO);
});

test("thread/start request includes stable serviceName for integration logs", () => {
  const request = createThreadStartRequest(2, { model: "gpt-5.4" });
  assert.equal((request.params as { serviceName: string }).serviceName, APP_SERVER_THREAD_SERVICE_NAME);
});

test("typed app-server client enforces handshake and Core method policy", async () => {
  const transport = new MemoryTransport();
  const client = new TypedAppServerClient(transport);
  await assert.rejects(() => client.request("thread/start", {}, { coreAuthorized: true }), /before initialize/);
  await client.initialize();
  assert.equal(transport.notifications[0]?.method, "initialized");
  await assert.rejects(() => client.request("thread/shellCommand", {}, { coreAuthorized: true }), /denied/);
  await assert.rejects(() => client.request("turn/start", {}, { coreAuthorized: false }), /requires Core authorization/);
  await client.request("turn/start", { threadId: "thread_1" }, { coreAuthorized: true });
  assert.equal(transport.requests.at(-1)?.method, "turn/start");
});

test("app-server side-effect methods remain classified for Core enforcement", () => {
  assert.equal(classifyAppServerMethod("command/exec").action, "route");
  assert.equal(classifyAppServerMethod("fs/readFile").action, "route");
  assert.equal(classifyAppServerMethod("plugin/install").action, "deny");
  assert.throws(() => classifyAppServerMethod("future/method"), ProtocolError);
});

test("app-server capability modules allow additive methods without changing Core", () => {
  const capabilities = createDefaultAppServerCapabilityRegistry();
  capabilities.registerModule({
    id: "app-server.future-context",
    title: "Future context read capability",
    version: "2026-04-24",
    methods: ["future/context/read"],
    policies: [
      {
        method: "future/context/read",
        family: "future_context",
        action: "allow",
        reason: "read-only future context capability is isolated behind the adapter registry"
      }
    ]
  });
  assert.equal(capabilities.classify("future/context/read").action, "allow");
  assert.deepEqual(capabilities.validateCoverage(["initialize", "future/context/read"]), []);

  const schema = new AppServerSchemaRegistry(capabilities);
  schema.register({ ...createOfficialDocsSchemaArtifact("future-protocol"), methods: ["initialize", "future/context/read"] });
  assert.equal(schema.methodPolicy("future/context/read").family, "future_context");
});

test("app-server notifications normalize into platform events", () => {
  assert.equal(
    normalizeAppServerNotification({ tenantId: "tenant", runId: "run", method: "item/started", payload: { itemId: "item" } }).type,
    "app_server.item_started"
  );
  assert.equal(
    normalizeAppServerNotification({ tenantId: "tenant", runId: "run", method: "item/commandExecution/requestApproval", payload: {} }).type,
    "app_server.approval_requested"
  );
});

test("approval request normalization preserves command/network semantics without credentials", () => {
  const approval = normalizeApprovalRequest({
    tenantId: "tenant",
    runId: "run",
    payload: {
      itemId: "item_1",
      threadId: "thread_1",
      turnId: "turn_1",
      reason: "needs command",
      command: "npm test",
      cwd: "/workspace"
    }
  });
  assert.equal(approval.approvalId, "approval_item_1");
  assert.equal(approval.kind, "command_execution");
  assert.equal(JSON.stringify(approval).includes("token"), false);

  const networkApproval = normalizeApprovalRequest({
    tenantId: "tenant",
    runId: "run",
    payload: {
      itemId: "item_2",
      threadId: "thread_1",
      networkApprovalContext: { host: "registry.npmjs.org", protocol: "https" }
    }
  });
  assert.equal(networkApproval.kind, "network");
});

test("retry schedule uses bounded exponential backoff with deterministic jitter", () => {
  assert.equal(createRetrySchedule(0) >= 250, true);
  assert.equal(createRetrySchedule(5) > createRetrySchedule(1), true);
  assert.equal(createRetrySchedule(20) <= 10_113, true);
});
