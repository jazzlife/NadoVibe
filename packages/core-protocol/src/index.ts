export type JsonRpcId = string | number;
export type MethodPolicyAction = "allow" | "deny" | "route";
export type MethodPolicyFamily =
  | "handshake"
  | "stable_read"
  | "thread_control"
  | "turn_control"
  | "approval_relay"
  | "workspace_side_effect"
  | "configuration_mutation"
  | "experimental_mutation";

export interface JsonRpcRequest {
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcNotification {
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcResponse {
  readonly id: JsonRpcId;
  readonly result?: unknown;
  readonly error?: JsonRpcErrorObject;
}

export interface JsonRpcErrorObject {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface MethodPolicy {
  readonly method: string;
  readonly family: MethodPolicyFamily;
  readonly action: MethodPolicyAction;
  readonly reason: string;
  readonly requiredFeatureFlag?: string;
}

export interface GeneratedAppServerSchemaArtifact {
  readonly codexVersion: string;
  readonly generatedAt: string;
  readonly generatorCommand: "codex app-server generate-ts" | "codex app-server generate-json-schema" | "official-docs-snapshot";
  readonly protocolFacts: readonly string[];
  readonly methods: readonly string[];
}

export interface TransportConfig {
  readonly listen: "stdio" | "off" | "websocket";
  readonly host?: string;
  readonly port?: number;
  readonly environment: "development" | "staging" | "production";
  readonly wsAuth?: "capability-token" | "signed-bearer-token";
  readonly allowExperimentalWebSocket?: boolean;
}

export interface AppServerClientInfo {
  readonly name: string;
  readonly title: string;
  readonly version: string;
}

export interface AppServerPlatformEvent {
  readonly type:
    | "app_server.session_requested"
    | "app_server.session_created"
    | "app_server.session_connected"
    | "app_server.thread_bound"
    | "app_server.turn_started"
    | "app_server.item_started"
    | "app_server.item_completed"
    | "app_server.event_received"
    | "app_server.approval_requested"
    | "app_server.approval_delivered"
    | "app_server.reconnect_started"
    | "app_server.reattached"
    | "app_server.recovering"
    | "app_server.closed"
    | "app_server.failed";
  readonly appServerMethod: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly payload: unknown;
}

export interface PlatformApprovalRequest {
  readonly approvalId: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly threadId: string;
  readonly turnId?: string;
  readonly itemId?: string;
  readonly reason: string;
  readonly kind: "command_execution" | "network" | "file_change";
  readonly command?: string;
  readonly cwd?: string;
}

export interface TypedAppServerTransport {
  request(message: JsonRpcRequest): Promise<JsonRpcResponse>;
  notify(message: JsonRpcNotification): Promise<void>;
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

export const OFFICIAL_APP_SERVER_FACTS = [
  "app-server is a Codex rich-client integration boundary, not the product source of truth",
  "wire messages use JSON-RPC 2.0 shape with the jsonrpc header omitted",
  "stdio JSONL is the default transport",
  "WebSocket transport is experimental and unsupported",
  "initialize request and initialized notification must complete before other methods",
  "core primitives include Thread, Turn, and Item",
  "thread/shellCommand runs outside sandbox with full access and must be denied by product Core",
  "command/exec* and fs/* must route through Core workspace policy",
  "config/plugin/marketplace mutation methods require explicit Core feature flags",
  "WebSocket overload returns retryable JSON-RPC code -32001"
] as const;

export const APP_SERVER_CLIENT_INFO: AppServerClientInfo = {
  name: "nadovibe_multi_agent_ide",
  title: "NadoVibe Multi-Agent IDE",
  version: "0.1.0"
};

export const APP_SERVER_THREAD_SERVICE_NAME = "nadovibe.app-server-adapter";

export const OFFICIAL_DOC_METHODS = [
  "initialize",
  "initialized",
  "thread/start",
  "thread/resume",
  "thread/fork",
  "thread/read",
  "thread/list",
  "thread/turns/list",
  "thread/loaded/list",
  "thread/name/set",
  "thread/metadata/update",
  "thread/archive",
  "thread/unsubscribe",
  "thread/unarchive",
  "thread/status/changed",
  "thread/compact/start",
  "thread/shellCommand",
  "thread/backgroundTerminals/clean",
  "thread/rollback",
  "turn/start",
  "thread/inject_items",
  "turn/steer",
  "turn/interrupt",
  "review/start",
  "command/exec",
  "command/exec/write",
  "command/exec/resize",
  "command/exec/terminate",
  "command/exec/outputDelta",
  "model/list",
  "experimentalFeature/list",
  "experimentalFeature/enablement/set",
  "collaborationMode/list",
  "skills/list",
  "skills/changed",
  "marketplace/add",
  "plugin/list",
  "plugin/read",
  "plugin/install",
  "plugin/uninstall",
  "app/list",
  "skills/config/write",
  "mcpServer/oauth/login",
  "tool/requestUserInput",
  "config/mcpServer/reload",
  "mcpServerStatus/list",
  "mcpServer/resource/read",
  "mcpServer/tool/call",
  "mcpServer/startupStatus/updated",
  "windowsSandbox/setupStart",
  "windowsSandbox/setupCompleted",
  "feedback/upload",
  "config/read",
  "externalAgentConfig/detect",
  "externalAgentConfig/import",
  "config/value/write",
  "config/batchWrite",
  "configRequirements/read",
  "fs/readFile",
  "fs/writeFile",
  "fs/createDirectory",
  "fs/getMetadata",
  "fs/readDirectory",
  "fs/remove",
  "fs/copy",
  "fs/watch",
  "fs/unwatch",
  "fs/changed",
  "item/started",
  "item/commandExecution/requestApproval",
  "serverRequest/resolved",
  "item/completed"
] as const;

const EXACT_POLICIES = new Map<string, MethodPolicy>([
  ["initialize", policy("initialize", "handshake", "allow", "handshake request is required")],
  ["initialized", policy("initialized", "handshake", "allow", "handshake notification is required")],
  ["thread/shellCommand", policy("thread/shellCommand", "workspace_side_effect", "deny", "official docs state this runs outside sandbox with full access")],
  ["thread/backgroundTerminals/clean", policy("thread/backgroundTerminals/clean", "experimental_mutation", "deny", "experimental terminal mutation requires explicit product design")],
  ["experimentalFeature/enablement/set", policy("experimentalFeature/enablement/set", "experimental_mutation", "deny", "runtime feature mutation is not allowed through product path", "appServerExperimentalMutation")],
  ["marketplace/add", policy("marketplace/add", "configuration_mutation", "deny", "marketplace mutation changes product execution surface", "appServerMarketplaceMutation")],
  ["plugin/install", policy("plugin/install", "configuration_mutation", "deny", "plugin installation changes product execution surface", "appServerPluginMutation")],
  ["plugin/uninstall", policy("plugin/uninstall", "configuration_mutation", "deny", "plugin removal changes product execution surface", "appServerPluginMutation")],
  ["skills/config/write", policy("skills/config/write", "configuration_mutation", "deny", "skill configuration mutation changes execution surface", "appServerSkillConfigMutation")],
  ["config/mcpServer/reload", policy("config/mcpServer/reload", "configuration_mutation", "deny", "MCP reload changes execution surface", "appServerConfigMutation")],
  ["config/value/write", policy("config/value/write", "configuration_mutation", "deny", "config mutation must not bypass Core policy", "appServerConfigMutation")],
  ["config/batchWrite", policy("config/batchWrite", "configuration_mutation", "deny", "config mutation must not bypass Core policy", "appServerConfigMutation")],
  ["externalAgentConfig/import", policy("externalAgentConfig/import", "configuration_mutation", "deny", "external agent import mutates local execution configuration", "appServerConfigMutation")],
  ["windowsSandbox/setupStart", policy("windowsSandbox/setupStart", "experimental_mutation", "deny", "platform targets Ubuntu server containers, not Windows sandbox setup")],
  ["windowsSandbox/setupCompleted", policy("windowsSandbox/setupCompleted", "experimental_mutation", "deny", "platform targets Ubuntu server containers, not Windows sandbox setup")],
  ["feedback/upload", policy("feedback/upload", "configuration_mutation", "deny", "feedback upload is outside product state contract")]
]);

function policy(
  method: string,
  family: MethodPolicyFamily,
  action: MethodPolicyAction,
  reason: string,
  requiredFeatureFlag?: string
): MethodPolicy {
  return requiredFeatureFlag === undefined
    ? { method, family, action, reason }
    : { method, family, action, reason, requiredFeatureFlag };
}

export function classifyAppServerMethod(method: string): MethodPolicy {
  const exact = EXACT_POLICIES.get(method);
  if (exact) {
    return exact;
  }

  if (method.startsWith("command/exec")) {
    return policy(method, "workspace_side_effect", "route", "command execution must route through Workspace Runtime policy");
  }
  if (method.startsWith("fs/")) {
    return policy(method, "workspace_side_effect", "route", "filesystem access must route through WorkScope and FileLease policy");
  }
  if (method.includes("requestApproval") || method === "serverRequest/resolved") {
    return policy(method, "approval_relay", "route", "approval requests are mirrored as platform ApprovalRequest records");
  }
  if (method.startsWith("turn/") || method === "thread/inject_items" || method === "review/start") {
    return policy(method, "turn_control", "route", "turn operations must mirror durable Core state");
  }
  if (
    method.startsWith("thread/start") ||
    method.startsWith("thread/resume") ||
    method.startsWith("thread/fork") ||
    method.startsWith("thread/name") ||
    method.startsWith("thread/metadata") ||
    method.startsWith("thread/archive") ||
    method.startsWith("thread/unarchive") ||
    method.startsWith("thread/unsubscribe") ||
    method.startsWith("thread/compact") ||
    method.startsWith("thread/rollback")
  ) {
    return policy(method, "thread_control", "route", "thread control must be mirrored in Core state");
  }
  if (
    method.startsWith("thread/read") ||
    method.startsWith("thread/list") ||
    method.startsWith("thread/turns/list") ||
    method.startsWith("thread/loaded/list") ||
    method === "model/list" ||
    method === "experimentalFeature/list" ||
    method === "collaborationMode/list" ||
    method === "skills/list" ||
    method === "plugin/list" ||
    method === "plugin/read" ||
    method === "app/list" ||
    method === "mcpServerStatus/list" ||
    method === "mcpServer/resource/read" ||
    method === "config/read" ||
    method === "configRequirements/read" ||
    method === "externalAgentConfig/detect"
  ) {
    return policy(method, "stable_read", "allow", "read-only method can be allowed after Core compatibility checks");
  }
  if (
    method.endsWith("/changed") ||
    method.endsWith("/completed") ||
    method === "thread/status/changed" ||
    method === "command/exec/outputDelta" ||
    method === "item/started" ||
    method === "item/completed" ||
    method === "mcpServer/startupStatus/updated"
  ) {
    return policy(method, "stable_read", "route", "notification must be ingested with offset and replay markers");
  }
  if (method === "mcpServer/oauth/login" || method === "mcpServer/tool/call" || method === "tool/requestUserInput") {
    return policy(method, "approval_relay", "route", "interactive external access must become a Core approval or tool request");
  }

  throw new ProtocolError(`Unclassified app-server method: ${method}`);
}

export function validateMethodPolicyCoverage(methods: readonly string[]): readonly string[] {
  const missing: string[] = [];
  for (const method of methods) {
    try {
      classifyAppServerMethod(method);
    } catch {
      missing.push(method);
    }
  }
  return missing;
}

export class AppServerSchemaRegistry {
  private artifact: GeneratedAppServerSchemaArtifact | undefined;

  register(artifact: GeneratedAppServerSchemaArtifact): void {
    const missing = validateMethodPolicyCoverage(artifact.methods);
    if (missing.length > 0) {
      throw new ProtocolError(`Cannot register schema with unclassified methods: ${missing.join(", ")}`);
    }
    this.artifact = artifact;
  }

  requireCurrent(codexVersion: string): GeneratedAppServerSchemaArtifact {
    if (!this.artifact) {
      throw new ProtocolError("App-server schema artifact has not been registered");
    }
    if (this.artifact.codexVersion !== codexVersion) {
      throw new ProtocolError(`App-server schema version mismatch: expected ${codexVersion}, actual ${this.artifact.codexVersion}`);
    }
    return this.artifact;
  }
}

export function createOfficialDocsSchemaArtifact(codexVersion = "official-docs-2026-04-23"): GeneratedAppServerSchemaArtifact {
  return {
    codexVersion,
    generatedAt: "2026-04-23T00:00:00.000Z",
    generatorCommand: "official-docs-snapshot",
    protocolFacts: OFFICIAL_APP_SERVER_FACTS,
    methods: OFFICIAL_DOC_METHODS
  };
}

export function createInitializeRequest(id: JsonRpcId, clientInfo: AppServerClientInfo = APP_SERVER_CLIENT_INFO): JsonRpcRequest {
  return {
    id,
    method: "initialize",
    params: { clientInfo }
  };
}

export function createInitializedNotification(): JsonRpcNotification {
  return { method: "initialized", params: {} };
}

export function createThreadStartRequest(id: JsonRpcId, params: Record<string, unknown>): JsonRpcRequest {
  return {
    id,
    method: "thread/start",
    params: {
      ...params,
      serviceName: APP_SERVER_THREAD_SERVICE_NAME
    }
  };
}

export function validateJsonRpcEnvelope(message: unknown): JsonRpcRequest | JsonRpcNotification | JsonRpcResponse {
  if (!isRecord(message)) {
    throw new ProtocolError("JSON-RPC envelope must be an object");
  }
  if ("jsonrpc" in message && message.jsonrpc !== "2.0") {
    throw new ProtocolError("If present, jsonrpc must be 2.0");
  }

  const hasMethod = typeof message.method === "string";
  const hasId = typeof message.id === "string" || typeof message.id === "number";
  const hasResultOrError = "result" in message || "error" in message;

  if (hasMethod && hasId) {
    const id = message.id as JsonRpcId;
    const method = message.method as string;
    return { id, method, params: message.params };
  }
  if (hasMethod && !("id" in message)) {
    const method = message.method as string;
    return { method, params: message.params };
  }
  if (hasId && hasResultOrError) {
    if ("error" in message && message.error !== undefined && !isJsonRpcErrorObject(message.error)) {
      throw new ProtocolError("JSON-RPC error object is invalid");
    }
    const id = message.id as JsonRpcId;
    if ("error" in message) {
      return { id, error: message.error as JsonRpcErrorObject };
    }
    return { id, result: message.result };
  }
  throw new ProtocolError("JSON-RPC envelope is neither request, notification, nor response");
}

export class AppServerHandshakeGate {
  private initializeAccepted = false;
  private initializedAccepted = false;

  observe(method: string): void {
    if (method === "initialize") {
      this.initializeAccepted = true;
      return;
    }
    if (method === "initialized") {
      if (!this.initializeAccepted) {
        throw new ProtocolError("initialized notification cannot arrive before initialize request");
      }
      this.initializedAccepted = true;
      return;
    }
    if (!this.initializeAccepted || !this.initializedAccepted) {
      throw new ProtocolError(`Method ${method} cannot be called before initialize/initialized handshake`);
    }
  }
}

export class TypedAppServerClient {
  private readonly gate = new AppServerHandshakeGate();
  private nextId = 1;
  private initialized = false;

  constructor(private readonly transport: TypedAppServerTransport) {}

  async initialize(clientInfo: AppServerClientInfo = APP_SERVER_CLIENT_INFO): Promise<JsonRpcResponse> {
    const initialize = createInitializeRequest(0, clientInfo);
    this.gate.observe("initialize");
    const response = await this.transport.request(initialize);
    const initialized = createInitializedNotification();
    this.gate.observe("initialized");
    await this.transport.notify(initialized);
    this.initialized = true;
    return response;
  }

  async request(method: string, params: unknown, options: { readonly coreAuthorized: boolean }): Promise<JsonRpcResponse> {
    if (!this.initialized) {
      this.gate.observe(method);
    }
    const policy = classifyAppServerMethod(method);
    if (policy.action === "deny") {
      throw new ProtocolError(`App-server method denied by Core policy: ${method}`);
    }
    if (policy.action === "route" && !options.coreAuthorized) {
      throw new ProtocolError(`App-server routed method requires Core authorization: ${method}`);
    }
    this.gate.observe(method);
    return this.transport.request({ id: this.nextId++, method, params });
  }
}

export function validateTransportConfig(config: TransportConfig): void {
  if (config.listen !== "websocket") {
    return;
  }
  if (config.environment === "production" && !config.allowExperimentalWebSocket) {
    throw new ProtocolError("Production cannot depend on unsupported app-server WebSocket transport");
  }
  if (!config.wsAuth) {
    throw new ProtocolError("App-server WebSocket listener requires explicit auth");
  }
  const host = config.host ?? "127.0.0.1";
  const isLoopback = host === "127.0.0.1" || host === "::1" || host === "localhost";
  if (!isLoopback && !config.wsAuth) {
    throw new ProtocolError("Remote app-server WebSocket listener requires auth");
  }
}

export function classifyOverloadError(error: JsonRpcErrorObject): "retryable" | "fatal" {
  if (error.code === -32001 && /overloaded|retry/i.test(error.message)) {
    return "retryable";
  }
  return "fatal";
}

export function createRetrySchedule(attempt: number, baseDelayMs = 250, maxDelayMs = 10_000): number {
  const cappedAttempt = Math.max(0, Math.min(attempt, 10));
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** cappedAttempt);
  const deterministicJitter = (cappedAttempt * 97) % 113;
  return exponential + deterministicJitter;
}

export function normalizeAppServerNotification(input: {
  readonly tenantId: string;
  readonly runId: string;
  readonly method: string;
  readonly payload: unknown;
}): AppServerPlatformEvent {
  const type = platformEventTypeForMethod(input.method);
  return {
    type,
    appServerMethod: input.method,
    tenantId: input.tenantId,
    runId: input.runId,
    payload: input.payload
  };
}

export function normalizeApprovalRequest(input: {
  readonly tenantId: string;
  readonly runId: string;
  readonly payload: Record<string, unknown>;
}): PlatformApprovalRequest {
  const network = input.payload.networkApprovalContext as Record<string, unknown> | undefined;
  const kind = network ? "network" : "command_execution";
  const threadId = stringField(input.payload, "threadId");
  const reasonValue = input.payload.reason;
  const command = typeof input.payload.command === "string" ? input.payload.command : undefined;
  const cwd = typeof input.payload.cwd === "string" ? input.payload.cwd : undefined;
  return {
    approvalId: `approval_${stringField(input.payload, "itemId")}`,
    tenantId: input.tenantId,
    runId: input.runId,
    threadId,
    ...(typeof input.payload.turnId === "string" ? { turnId: input.payload.turnId } : {}),
    ...(typeof input.payload.itemId === "string" ? { itemId: input.payload.itemId } : {}),
    reason: typeof reasonValue === "string" && reasonValue.length > 0 ? reasonValue : "App-server requested approval",
    kind,
    ...(command === undefined ? {} : { command }),
    ...(cwd === undefined ? {} : { cwd })
  };
}

function platformEventTypeForMethod(method: string): AppServerPlatformEvent["type"] {
  if (method === "thread/started") return "app_server.thread_bound";
  if (method === "turn/started") return "app_server.turn_started";
  if (method === "item/started") return "app_server.item_started";
  if (method === "item/completed") return "app_server.item_completed";
  if (method === "item/commandExecution/requestApproval") return "app_server.approval_requested";
  if (method === "thread/status/changed") return "app_server.event_received";
  if (/closed/.test(method)) return "app_server.closed";
  if (/failed/.test(method)) return "app_server.failed";
  return "app_server.event_received";
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ProtocolError(`Approval payload missing ${key}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJsonRpcErrorObject(value: unknown): value is JsonRpcErrorObject {
  return isRecord(value) && typeof value.code === "number" && typeof value.message === "string";
}
