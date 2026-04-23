import type {
  ApprovalDecisionRequest,
  ConflictEscalationRequest,
  ControlRoomProjectionResponse,
  CreateRunRequest,
  CreateRunResponse,
  DevIdentitySeedRequest,
  DevIdentitySeedResponse,
  EditorSessionRequest,
  EnqueueCommandRequest,
  FinalReviewDecisionRequest,
  HunkDecisionRequest,
  SupervisorControlRequest,
  WorkspaceFileReadRequest,
  WorkspaceSearchRequest,
  WorkspaceSearchResponse,
  WorkspaceFileTreeRequest,
  WorkspaceFileWriteRequest
} from "./index.js";

export interface GeneratedGatewayClientOptions {
  readonly baseUrl: string;
  readonly requestIdPrefix?: string;
}

export interface GeneratedGatewayClient {
  seedIdentity(request: DevIdentitySeedRequest): Promise<DevIdentitySeedResponse>;
  getControlRoom(role?: "user" | "operator"): Promise<ControlRoomProjectionResponse>;
  createRun(request: CreateRunRequest): Promise<CreateRunResponse>;
  enqueueCommand(request: EnqueueCommandRequest): Promise<ControlRoomProjectionResponse>;
  decideApproval(request: ApprovalDecisionRequest): Promise<ControlRoomProjectionResponse>;
  controlSupervisor(request: SupervisorControlRequest): Promise<ControlRoomProjectionResponse>;
  escalateConflict(request: ConflictEscalationRequest): Promise<ControlRoomProjectionResponse>;
  changeEditorSession(request: EditorSessionRequest): Promise<ControlRoomProjectionResponse>;
  decideFinalReview(request: FinalReviewDecisionRequest): Promise<ControlRoomProjectionResponse>;
  readFileTree(request: WorkspaceFileTreeRequest): Promise<{ readonly items: readonly unknown[] }>;
  readFile(request: WorkspaceFileReadRequest): Promise<{ readonly path: string; readonly content: string }>;
  writeFile(request: WorkspaceFileWriteRequest): Promise<ControlRoomProjectionResponse>;
  searchWorkspace(request: WorkspaceSearchRequest): Promise<WorkspaceSearchResponse>;
  decideHunk(request: HunkDecisionRequest): Promise<ControlRoomProjectionResponse>;
}

export function createGeneratedGatewayClient(options: GeneratedGatewayClientOptions): GeneratedGatewayClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const prefix = options.requestIdPrefix ?? "generated";
  let sequence = 0;

  async function request<TResponse>(method: string, path: string, body?: unknown): Promise<TResponse> {
    sequence += 1;
    const init: RequestInit = {
      method,
      headers: {
        "content-type": "application/json",
        "x-request-id": `${prefix}_${sequence}`
      }
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${baseUrl}${path}`, init);
    const payload = (await response.json()) as TResponse | { readonly error: string };
    if (!response.ok) {
      const message = typeof (payload as { readonly error?: unknown }).error === "string" ? (payload as { readonly error: string }).error : "request failed";
      throw new Error(message);
    }
    return payload as TResponse;
  }

  return {
    seedIdentity: (body) => request("POST", "/api/dev/seed", body),
    getControlRoom: (role = "user") => request("GET", `/api/control-room?role=${encodeURIComponent(role)}`),
    createRun: (body) => request("POST", "/api/runs", body),
    enqueueCommand: (body) => request("POST", "/api/commands", body),
    decideApproval: (body) => request("POST", "/api/approvals/decision", body),
    controlSupervisor: (body) => request("POST", "/api/supervisor/control", body),
    escalateConflict: (body) => request("POST", "/api/conflicts/escalate", body),
    changeEditorSession: (body) => request("POST", "/api/editor-session", body),
    decideFinalReview: (body) => request("POST", "/api/final-review", body),
    readFileTree: (body) => request("GET", `/api/workspace/files/tree?workspaceId=${encodeURIComponent(body.workspaceId)}&path=${encodeURIComponent(body.path ?? "")}`),
    readFile: (body) => request("GET", `/api/workspace/files/read?workspaceId=${encodeURIComponent(body.workspaceId)}&path=${encodeURIComponent(body.path)}`),
    writeFile: (body) => request("POST", "/api/workspace/files/write", body),
    searchWorkspace: (body) =>
      request("GET", `/api/workspace/search?workspaceId=${encodeURIComponent(body.workspaceId)}&query=${encodeURIComponent(body.query)}&path=${encodeURIComponent(body.path ?? "")}`),
    decideHunk: (body) => request("POST", "/api/diff/hunks/decision", body)
  };
}

export function renderGeneratedGatewayBrowserClient(defaultBaseUrl: string): string {
  return `
(() => {
  const defaultBaseUrl = ${JSON.stringify(defaultBaseUrl)};
  function createGatewayClient(baseUrl = defaultBaseUrl) {
    let sequence = 0;
    const root = String(baseUrl || '').replace(/\\/$/, '');
    async function request(method, path, body) {
      sequence += 1;
      const response = await fetch(root + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-request-id': 'web_' + sequence },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload && payload.error ? payload.error : 'request failed');
      return payload;
    }
    return {
      seedIdentity: (body) => request('POST', '/api/dev/seed', body),
      getControlRoom: (role = 'user') => request('GET', '/api/control-room?role=' + encodeURIComponent(role)),
      createRun: (body) => request('POST', '/api/runs', body),
      enqueueCommand: (body) => request('POST', '/api/commands', body),
      decideApproval: (body) => request('POST', '/api/approvals/decision', body),
      controlSupervisor: (body) => request('POST', '/api/supervisor/control', body),
      escalateConflict: (body) => request('POST', '/api/conflicts/escalate', body),
      changeEditorSession: (body) => request('POST', '/api/editor-session', body),
      decideFinalReview: (body) => request('POST', '/api/final-review', body),
      readFileTree: (body) => request('GET', '/api/workspace/files/tree?workspaceId=' + encodeURIComponent(body.workspaceId) + '&path=' + encodeURIComponent(body.path || '')),
      readFile: (body) => request('GET', '/api/workspace/files/read?workspaceId=' + encodeURIComponent(body.workspaceId) + '&path=' + encodeURIComponent(body.path)),
      writeFile: (body) => request('POST', '/api/workspace/files/write', body),
      searchWorkspace: (body) => request('GET', '/api/workspace/search?workspaceId=' + encodeURIComponent(body.workspaceId) + '&query=' + encodeURIComponent(body.query) + '&path=' + encodeURIComponent(body.path || '')),
      decideHunk: (body) => request('POST', '/api/diff/hunks/decision', body),
      openStream: (after = 0) => new EventSource(root + '/api/stream?after=' + encodeURIComponent(after))
    };
  }
  window.NadoVibeGatewayClient = { createGatewayClient };
})();
`;
}
