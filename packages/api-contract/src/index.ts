import type { AgentTaskContract, DomainEvent, IdentitySeedRecord, PlatformReadModels, RunRecord, RunState, ServiceHealth } from "@nadovibe/domain";
import type { ResourceClass } from "@nadovibe/core-resource";
export * from "./generated-client.js";

export interface ApiErrorResponse {
  readonly error: string;
  readonly requestId: string;
}

export interface DevIdentitySeedRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
}

export interface DevIdentitySeedResponse {
  readonly seed: IdentitySeedRecord;
}

export interface CreateRunRequest {
  readonly runId: string;
  readonly workspaceId: string;
  readonly idempotencyKey: string;
  readonly repositoryId?: string;
  readonly objective?: string;
}

export interface CreateRunResponse {
  readonly run: RunRecord;
  readonly userStatus?: UserRunStatus;
  readonly projection?: ControlRoomProjectionResponse;
}

export interface HealthResponse extends ServiceHealth {
  readonly requestId: string;
}

export type UserRunStatus = "accepted" | "preparing" | "in_progress" | "needs_review" | "completed" | "failed" | "cancelled";

export interface PublicProjectionResponse {
  readonly readModels: Omit<PlatformReadModels, "resources">;
}

export interface AdminCapacityResponse {
  readonly reservations: number;
  readonly overloadSignals: number;
  readonly queueDepth: number;
}

export interface RealtimeFrame {
  readonly offset: number;
  readonly event: unknown;
}

export type UserRole = "user" | "operator";
export type CommandResourceIntent = "light" | "test" | "build" | "long_running";
export type SupervisorControlAction =
  | "pause"
  | "resume"
  | "cancel"
  | "retry"
  | "reassign"
  | "extend_lease"
  | "revoke_lease"
  | "accept_report"
  | "reject_report";

export interface EnqueueCommandRequest {
  readonly runId: string;
  readonly instruction: string;
  readonly targetAgentId?: string;
  readonly resourceIntent: CommandResourceIntent;
  readonly selection?: CommandSelection;
  readonly idempotencyKey: string;
}

export interface CommandSelection {
  readonly path: string;
  readonly fromLine: number;
  readonly toLine: number;
  readonly text: string;
}

export interface ApprovalDecisionRequest {
  readonly approvalId: string;
  readonly decision: "approve" | "reject";
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface ConflictEscalationRequest {
  readonly conflictId: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface SupervisorControlRequest {
  readonly runId: string;
  readonly action: SupervisorControlAction;
  readonly targetAgentId?: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface EditorSessionRequest {
  readonly workspaceId: string;
  readonly action: "issue" | "reissue" | "revoke";
  readonly idempotencyKey: string;
}

export interface FinalReviewDecisionRequest {
  readonly runId: string;
  readonly decision: "approve" | "request_changes";
  readonly reason: string;
  readonly idempotencyKey: string;
}

export interface WorkspaceFileTreeRequest {
  readonly workspaceId: string;
  readonly path?: string;
}

export interface WorkspaceFileReadRequest {
  readonly workspaceId: string;
  readonly path: string;
}

export interface WorkspaceFileReadResponse {
  readonly path: string;
  readonly content: string;
  readonly fileLeaseId: string;
  readonly leaseExpiresAt: number;
}

export interface WorkspaceFileWriteRequest {
  readonly workspaceId: string;
  readonly path: string;
  readonly content: string;
  readonly fileLeaseId: string;
  readonly idempotencyKey: string;
}

export interface WorkspaceSearchRequest {
  readonly workspaceId: string;
  readonly query: string;
  readonly path?: string;
}

export interface WorkspaceSearchResultItem {
  readonly path: string;
  readonly line: number;
  readonly preview: string;
}

export interface WorkspaceSearchResponse {
  readonly workspaceId: string;
  readonly query: string;
  readonly results: readonly WorkspaceSearchResultItem[];
}

export interface HunkDecisionRequest {
  readonly path: string;
  readonly hunkId: string;
  readonly decision: "approve" | "request_changes";
  readonly reason: string;
  readonly idempotencyKey: string;
}

export type MobilePushPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface MobilePushRegistrationRequest {
  readonly workspaceId: string;
  readonly permission: MobilePushPermissionState;
  readonly endpoint: string;
  readonly routeOnClick: string;
  readonly idempotencyKey: string;
}

export interface NotificationSettingsRequest {
  readonly workspaceId: string;
  readonly enabled: boolean;
  readonly approvals: boolean;
  readonly recovery: boolean;
  readonly finalReview: boolean;
  readonly quietHeavyWork: boolean;
  readonly idempotencyKey: string;
}

export interface NotificationReadRequest {
  readonly notificationId: string;
  readonly idempotencyKey: string;
}

export interface WorkspaceSummary {
  readonly workspaceId: string;
  readonly name: string;
  readonly status: "ready" | "preparing" | "recovering" | "stopped";
  readonly repositoryId: string;
}

export interface RepositorySummary {
  readonly repositoryId: string;
  readonly name: string;
  readonly branch: string;
  readonly workspaceId: string;
}

export interface RunSummary {
  readonly runId: string;
  readonly workspaceId: string;
  readonly objective: string;
  readonly userStatus: UserRunStatus;
  readonly currentStep: "accepted" | "analyzing" | "preparing" | "executing" | "reviewing" | "complete";
  readonly progressPercent: number;
}

export interface LifecycleStep {
  readonly id: string;
  readonly label: string;
  readonly state: "done" | "active" | "upcoming" | "recovering" | "blocked";
}

export interface AgentHierarchyItem {
  readonly agentId: string;
  readonly parentAgentId?: string;
  readonly runId: string;
  readonly role: "SupervisorAgent" | "TaskSupervisorAgent" | "RoleAgent";
  readonly label: string;
  readonly state: "observing" | "working" | "waiting" | "handoff" | "recovering" | "complete";
}

export interface SupervisorDecisionItem {
  readonly decisionId: string;
  readonly runId: string;
  readonly observedState: string;
  readonly selectedAction: string;
  readonly policyReason: string;
  readonly expectedVerification: readonly string[];
}

export interface AgentContractItem {
  readonly contractId: string;
  readonly agentId: string;
  readonly runId: string;
  readonly objective: string;
  readonly workScope: string;
  readonly ownedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly budget: {
    readonly commands: number;
    readonly retries: number;
    readonly wallClockMinutes: number;
  };
  readonly verification: readonly string[];
  readonly escalationRule: readonly string[];
}

export interface LeaseBudgetItem {
  readonly agentId: string;
  readonly heartbeat: "fresh" | "late" | "recovering";
  readonly timeoutLabel: string;
  readonly retryBudget: string;
  readonly commandBudget: string;
  readonly blockerAgeLabel?: string;
}

export interface BlockerItem {
  readonly blockerId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly title: string;
  readonly nextAction: string;
}

export interface HandoffItem {
  readonly handoffId: string;
  readonly runId: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly reason: string;
}

export interface CommandQueueItem {
  readonly commandId: string;
  readonly runId: string;
  readonly instruction: string;
  readonly state: "received" | "ready" | "preparing" | "running" | "completed" | "needs_review" | "cancelled";
  readonly resourceIntent: CommandResourceIntent;
  readonly selection?: CommandSelection;
}

export interface ApprovalInboxProjectionItem {
  readonly approvalId: string;
  readonly runId?: string;
  readonly reason: string;
  readonly state: "requested" | "approved" | "rejected" | "expired";
  readonly destructive: boolean;
}

export interface ConflictQueueItem {
  readonly conflictId: string;
  readonly runId: string;
  readonly files: readonly string[];
  readonly summary: string;
  readonly state: "detected" | "escalated" | "resolved";
}

export interface RecoveryQueueItem {
  readonly recoveryId: string;
  readonly runId: string;
  readonly title: string;
  readonly state: "recovering" | "ready_to_retry" | "resolved";
  readonly nextAction: string;
}

export interface TimelineProjectionItem {
  readonly offset: number;
  readonly eventId: string;
  readonly runId: string;
  readonly label: string;
  readonly detail: string;
  readonly timestamp: string;
}

export interface EditorSessionProjection {
  readonly workspaceId: string;
  readonly state: "not_issued" | "starting" | "ready" | "recovering" | "expired" | "revoked";
  readonly publicRoute?: string;
  readonly expiresAt?: number;
  readonly message: string;
}

export interface FileTreeItem {
  readonly path: string;
  readonly name: string;
  readonly type: "file" | "directory";
  readonly depth: number;
}

export interface DiffHunk {
  readonly hunkId: string;
  readonly title: string;
  readonly additions: number;
  readonly deletions: number;
  readonly state: "pending" | "approved" | "changes_requested";
}

export interface DiffFileItem {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  readonly hunks: readonly DiffHunk[];
}

export interface TerminalOutputItem {
  readonly lineId: string;
  readonly runId: string;
  readonly stream: "stdout" | "stderr" | "system";
  readonly text: string;
}

export interface ArtifactProjectionItem {
  readonly artifactId: string;
  readonly runId: string;
  readonly label: string;
  readonly contentType: string;
  readonly sizeLabel: string;
}

export interface ServiceHealthProjectionItem {
  readonly service: string;
  readonly state: "healthy" | "degraded" | "recovering";
  readonly detail: string;
  readonly operatorOnly: boolean;
}

export interface FinalReviewGateProjection {
  readonly runId?: string;
  readonly state: "not_ready" | "ready" | "approved" | "changes_requested";
  readonly checklist: readonly { readonly label: string; readonly done: boolean }[];
}

export interface NotificationInboxItem {
  readonly notificationId: string;
  readonly title: string;
  readonly body: string;
  readonly route: string;
  readonly unread: boolean;
}

export type MobileNextActionKind = "approval" | "conflict" | "recovery" | "final_review" | "run" | "notification";

export interface MobileNextActionItem {
  readonly actionId: string;
  readonly kind: MobileNextActionKind;
  readonly title: string;
  readonly body: string;
  readonly route: string;
  readonly priority: "critical" | "normal" | "low";
  readonly destructive: boolean;
  readonly runId?: string;
  readonly confirmationLabel?: string;
}

export interface MobileDiffSummary {
  readonly fileCount: number;
  readonly hunkCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly riskyFiles: readonly string[];
  readonly testStatus: "pending" | "passed" | "needs_review" | "unknown";
  readonly hunks: readonly {
    readonly path: string;
    readonly hunkId: string;
    readonly title: string;
    readonly state: DiffHunk["state"];
  }[];
}

export interface MobileNotificationSettingsProjection {
  readonly workspaceId: string;
  readonly enabled: boolean;
  readonly approvals: boolean;
  readonly recovery: boolean;
  readonly finalReview: boolean;
  readonly quietHeavyWork: boolean;
}

export interface MobilePushRegistrationProjection {
  readonly workspaceId: string;
  readonly permission: MobilePushPermissionState;
  readonly registered: boolean;
  readonly endpointLabel?: string;
  readonly routeOnClick: string;
}

export interface MobileServiceStatusProjection {
  readonly realtime: "connected" | "reconnecting" | "offline";
  readonly workspace: "ready" | "preparing" | "recovering" | "stopped";
  readonly message: string;
  readonly workspaceMessage: string;
}

export interface MobileCommandReviewProjectionResponse {
  readonly generatedAt: string;
  readonly lastOffset: number;
  readonly inbox: readonly NotificationInboxItem[];
  readonly nextActions: readonly MobileNextActionItem[];
  readonly runs: readonly RunSummary[];
  readonly agents: readonly AgentHierarchyItem[];
  readonly approvals: readonly ApprovalInboxProjectionItem[];
  readonly conflicts: readonly ConflictQueueItem[];
  readonly recovery: readonly RecoveryQueueItem[];
  readonly diffSummary: MobileDiffSummary;
  readonly finalReview: FinalReviewGateProjection;
  readonly serviceStatus: MobileServiceStatusProjection;
  readonly notificationSettings: MobileNotificationSettingsProjection;
  readonly pushRegistration: MobilePushRegistrationProjection;
  readonly reconnect: ControlRoomProjectionResponse["reconnect"];
}

export interface ControlRoomProjectionResponse {
  readonly generatedAt: string;
  readonly role: UserRole;
  readonly lastOffset: number;
  readonly workspaces: readonly WorkspaceSummary[];
  readonly repositories: readonly RepositorySummary[];
  readonly runs: readonly RunSummary[];
  readonly lifecycle: readonly LifecycleStep[];
  readonly agentHierarchy: readonly AgentHierarchyItem[];
  readonly supervisorDecisions: readonly SupervisorDecisionItem[];
  readonly agentContracts: readonly AgentContractItem[];
  readonly leaseBudget: readonly LeaseBudgetItem[];
  readonly blockers: readonly BlockerItem[];
  readonly handoffs: readonly HandoffItem[];
  readonly commandQueue: readonly CommandQueueItem[];
  readonly approvalInbox: readonly ApprovalInboxProjectionItem[];
  readonly conflictQueue: readonly ConflictQueueItem[];
  readonly recoveryQueue: readonly RecoveryQueueItem[];
  readonly timeline: readonly TimelineProjectionItem[];
  readonly editorSession: EditorSessionProjection;
  readonly fileTree: readonly FileTreeItem[];
  readonly diff: readonly DiffFileItem[];
  readonly terminal: readonly TerminalOutputItem[];
  readonly artifacts: readonly ArtifactProjectionItem[];
  readonly serviceHealth: readonly ServiceHealthProjectionItem[];
  readonly finalReview: FinalReviewGateProjection;
  readonly notifications: readonly NotificationInboxItem[];
  readonly reconnect: {
    readonly state: "connected" | "reconnecting" | "offline";
    readonly message: string;
  };
}

export function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

export function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

export function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }
  return value;
}

export function parseDevIdentitySeedRequest(value: unknown): DevIdentitySeedRequest {
  const record = requireObject(value, "DevIdentitySeedRequest");
  return {
    tenantId: requireString(record, "tenantId"),
    userId: requireString(record, "userId"),
    workspaceId: requireString(record, "workspaceId"),
    repositoryId: requireString(record, "repositoryId")
  };
}

export function parseCreateRunRequest(value: unknown): CreateRunRequest {
  const record = requireObject(value, "CreateRunRequest");
  const request: CreateRunRequest = {
    runId: requireString(record, "runId"),
    workspaceId: requireString(record, "workspaceId"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
  if (typeof record.repositoryId === "string" && record.repositoryId.trim().length > 0) {
    (request as { repositoryId: string }).repositoryId = record.repositoryId;
  }
  if (typeof record.objective === "string" && record.objective.trim().length > 0) {
    (request as { objective: string }).objective = record.objective;
  }
  return request;
}

export function parseEnqueueCommandRequest(value: unknown): EnqueueCommandRequest {
  const record = requireObject(value, "EnqueueCommandRequest");
  const resourceIntent = requireString(record, "resourceIntent");
  if (!["light", "test", "build", "long_running"].includes(resourceIntent)) {
    throw new Error("resourceIntent is invalid");
  }
  const request: EnqueueCommandRequest = {
    runId: requireString(record, "runId"),
    instruction: requireString(record, "instruction"),
    resourceIntent: resourceIntent as CommandResourceIntent,
    idempotencyKey: requireString(record, "idempotencyKey")
  };
  if (typeof record.targetAgentId === "string" && record.targetAgentId.trim().length > 0) {
    (request as { targetAgentId: string }).targetAgentId = record.targetAgentId;
  }
  if (record.selection !== undefined) {
    const selection = requireObject(record.selection, "selection");
    const fromLine = requireNumber(selection, "fromLine");
    const toLine = requireNumber(selection, "toLine");
    if (fromLine < 1 || toLine < fromLine) {
      throw new Error("selection range is invalid");
    }
    (request as { selection: CommandSelection }).selection = {
      path: requireString(selection, "path"),
      fromLine,
      toLine,
      text: requireString(selection, "text")
    };
  }
  return request;
}

export function parseApprovalDecisionRequest(value: unknown): ApprovalDecisionRequest {
  const record = requireObject(value, "ApprovalDecisionRequest");
  const decision = requireString(record, "decision");
  if (decision !== "approve" && decision !== "reject") {
    throw new Error("decision is invalid");
  }
  return {
    approvalId: requireString(record, "approvalId"),
    decision,
    reason: requireString(record, "reason"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseConflictEscalationRequest(value: unknown): ConflictEscalationRequest {
  const record = requireObject(value, "ConflictEscalationRequest");
  return {
    conflictId: requireString(record, "conflictId"),
    reason: requireString(record, "reason"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseSupervisorControlRequest(value: unknown): SupervisorControlRequest {
  const record = requireObject(value, "SupervisorControlRequest");
  const action = requireString(record, "action");
  const allowed: readonly string[] = ["pause", "resume", "cancel", "retry", "reassign", "extend_lease", "revoke_lease", "accept_report", "reject_report"];
  if (!allowed.includes(action)) {
    throw new Error("action is invalid");
  }
  const request: SupervisorControlRequest = {
    runId: requireString(record, "runId"),
    action: action as SupervisorControlAction,
    reason: requireString(record, "reason"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
  if (typeof record.targetAgentId === "string" && record.targetAgentId.trim().length > 0) {
    (request as { targetAgentId: string }).targetAgentId = record.targetAgentId;
  }
  return request;
}

export function parseEditorSessionRequest(value: unknown): EditorSessionRequest {
  const record = requireObject(value, "EditorSessionRequest");
  const action = requireString(record, "action");
  if (!["issue", "reissue", "revoke"].includes(action)) {
    throw new Error("action is invalid");
  }
  return {
    workspaceId: requireString(record, "workspaceId"),
    action: action as "issue" | "reissue" | "revoke",
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseFinalReviewDecisionRequest(value: unknown): FinalReviewDecisionRequest {
  const record = requireObject(value, "FinalReviewDecisionRequest");
  const decision = requireString(record, "decision");
  if (decision !== "approve" && decision !== "request_changes") {
    throw new Error("decision is invalid");
  }
  return {
    runId: requireString(record, "runId"),
    decision,
    reason: requireString(record, "reason"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseWorkspaceFileWriteRequest(value: unknown): WorkspaceFileWriteRequest {
  const record = requireObject(value, "WorkspaceFileWriteRequest");
  return {
    workspaceId: requireString(record, "workspaceId"),
    path: requireString(record, "path"),
    content: requireString(record, "content"),
    fileLeaseId: requireString(record, "fileLeaseId"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseWorkspaceSearchRequest(value: unknown): WorkspaceSearchRequest {
  const record = requireObject(value, "WorkspaceSearchRequest");
  const request: WorkspaceSearchRequest = {
    workspaceId: requireString(record, "workspaceId"),
    query: requireString(record, "query")
  };
  if (typeof record.path === "string" && record.path.trim().length > 0) {
    (request as { path: string }).path = record.path;
  }
  return request;
}

export function parseHunkDecisionRequest(value: unknown): HunkDecisionRequest {
  const record = requireObject(value, "HunkDecisionRequest");
  const decision = requireString(record, "decision");
  if (decision !== "approve" && decision !== "request_changes") {
    throw new Error("decision is invalid");
  }
  return {
    path: requireString(record, "path"),
    hunkId: requireString(record, "hunkId"),
    decision,
    reason: requireString(record, "reason"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseMobilePushRegistrationRequest(value: unknown): MobilePushRegistrationRequest {
  const record = requireObject(value, "MobilePushRegistrationRequest");
  const permission = requireString(record, "permission");
  if (!["default", "granted", "denied", "unsupported"].includes(permission)) {
    throw new Error("permission is invalid");
  }
  return {
    workspaceId: requireString(record, "workspaceId"),
    permission: permission as MobilePushPermissionState,
    endpoint: requireString(record, "endpoint"),
    routeOnClick: requireString(record, "routeOnClick"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseNotificationSettingsRequest(value: unknown): NotificationSettingsRequest {
  const record = requireObject(value, "NotificationSettingsRequest");
  return {
    workspaceId: requireString(record, "workspaceId"),
    enabled: requireBoolean(record, "enabled"),
    approvals: requireBoolean(record, "approvals"),
    recovery: requireBoolean(record, "recovery"),
    finalReview: requireBoolean(record, "finalReview"),
    quietHeavyWork: requireBoolean(record, "quietHeavyWork"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function parseNotificationReadRequest(value: unknown): NotificationReadRequest {
  const record = requireObject(value, "NotificationReadRequest");
  return {
    notificationId: requireString(record, "notificationId"),
    idempotencyKey: requireString(record, "idempotencyKey")
  };
}

export function mapInternalRunStateToUserStatus(state: RunState): UserRunStatus {
  switch (state) {
    case "draft":
    case "queued":
      return "accepted";
    case "waiting_for_capacity":
    case "planning":
    case "planned":
    case "assigning":
    case "preparing_workspace":
    case "binding_app_server":
    case "recovering":
      return "preparing";
    case "running":
    case "waiting_for_input":
    case "blocked":
    case "verifying":
    case "integrating":
      return "in_progress";
    case "waiting_for_approval":
    case "ready_for_review":
      return "needs_review";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
  }
}

export function publicProjection(readModels: PlatformReadModels): PublicProjectionResponse {
  const { resources: _resources, ...publicModels } = readModels;
  return {
    readModels: {
      ...publicModels,
      timeline: publicModels.timeline.map((item) => ({
        ...item,
        summary: sanitizePublicText(item.summary)
      }))
    }
  };
}

export function rebuildControlRoomProjection(
  events: readonly DomainEvent[],
  options: { readonly role?: UserRole; readonly fileTree?: readonly FileTreeItem[] } = {}
): ControlRoomProjectionResponse {
  const role = options.role ?? "user";
  const workspaces = new Map<string, WorkspaceSummary>();
  const repositories = new Map<string, RepositorySummary>();
  const runs = new Map<string, RunSummary>();
  const agentHierarchy = new Map<string, AgentHierarchyItem>();
  const supervisorDecisions: SupervisorDecisionItem[] = [];
  const agentContracts = new Map<string, AgentContractItem>();
  const leaseBudget = new Map<string, LeaseBudgetItem>();
  const blockers = new Map<string, BlockerItem>();
  const handoffs = new Map<string, HandoffItem>();
  const commandQueue = new Map<string, CommandQueueItem>();
  const approvalInbox = new Map<string, ApprovalInboxProjectionItem>();
  const conflictQueue = new Map<string, ConflictQueueItem>();
  const recoveryQueue = new Map<string, RecoveryQueueItem>();
  const timeline: TimelineProjectionItem[] = [];
  const diff = new Map<string, DiffFileItem>();
  const terminal: TerminalOutputItem[] = [];
  const artifacts = new Map<string, ArtifactProjectionItem>();
  const notifications = new Map<string, NotificationInboxItem>();
  let finalReview: FinalReviewGateProjection = {
    state: "not_ready",
    checklist: [
      { label: "변경 검토", done: false },
      { label: "테스트 확인", done: false },
      { label: "승인 정리", done: false }
    ]
  };
  let editorSession: EditorSessionProjection = {
    workspaceId: workspaces.keys().next().value ?? "workspace_dev",
    state: "not_issued",
    message: "독립 code-server 세션이 아직 발급되지 않았습니다."
  };

  events.forEach((event, index) => {
    const runId = event.aggregateType === "Run" ? event.aggregateId : readString(event.payload, "runId");
    if (runId) {
      timeline.push({
        offset: index + 1,
        eventId: event.id,
        runId,
        label: labelEvent(event.type),
        detail: productDetail(event),
        timestamp: event.metadata.timestamp
      });
    }

    if (event.type === "WorkspaceCatalogSeeded") {
      const workspaceId = readString(event.payload, "workspaceId") ?? "workspace_dev";
      const repositoryId = readString(event.payload, "repositoryId") ?? "repo_dev";
      workspaces.set(workspaceId, {
        workspaceId,
        name: readString(event.payload, "workspaceName") ?? "NadoVibe Workspace",
        status: "ready",
        repositoryId
      });
      repositories.set(repositoryId, {
        repositoryId,
        workspaceId,
        name: readString(event.payload, "repositoryName") ?? "NadoVibe",
        branch: readString(event.payload, "branch") ?? "main"
      });
      editorSession = { ...editorSession, workspaceId };
    }

    if (event.type === "RunCreated") {
      const run = event.payload as RunRecord;
      runs.set(run.id, {
        runId: run.id,
        workspaceId: run.workspaceId,
        objective: "에이전트 작업 준비",
        userStatus: mapInternalRunStateToUserStatus(run.state),
        currentStep: "accepted",
        progressPercent: 8
      });
    }

    if (event.type === "RunObjectiveUpdated") {
      const runIdValue = readString(event.payload, "runId");
      const existing = runIdValue ? runs.get(runIdValue) : undefined;
      if (runIdValue && existing) {
        runs.set(runIdValue, { ...existing, objective: readString(event.payload, "objective") ?? existing.objective });
      }
    }

    if (event.type === "RunStateChanged") {
      const existing = runs.get(event.aggregateId);
      if (existing) {
        const to = readString(event.payload, "to") as RunState | undefined;
        const mapped = to ? mapRunStateToStep(to) : { userStatus: existing.userStatus, currentStep: existing.currentStep, progressPercent: existing.progressPercent };
        runs.set(event.aggregateId, { ...existing, ...mapped });
      }
    }

    if (event.type === "AgentHierarchyRecorded") {
      const item = event.payload as AgentHierarchyItem;
      agentHierarchy.set(item.agentId, item);
    }

    if (event.type === "AgentTaskContractAccepted") {
      const contract = event.payload as AgentTaskContract;
      agentContracts.set(contract.id, contractToProjection(contract));
      if (!agentHierarchy.has(`agent_${contract.id}`)) {
        const item: AgentHierarchyItem = {
          agentId: `agent_${contract.id}`,
          runId: contract.parentRunId,
          role: "RoleAgent",
          label: contract.objective,
          state: "working"
        };
        if (contract.parentAgentId) {
          (item as { parentAgentId: string }).parentAgentId = contract.parentAgentId;
        }
        agentHierarchy.set(`agent_${contract.id}`, item);
      }
    }

    if (event.type === "SupervisorDecisionRecorded") {
      const payload = event.payload as {
        id: string;
        runId: string;
        observedState: string;
        selectedAction: string;
        policyReason: string;
        expectedVerification: readonly string[];
      };
      supervisorDecisions.unshift({
        decisionId: payload.id,
        runId: payload.runId,
        observedState: payload.observedState,
        selectedAction: payload.selectedAction,
        policyReason: payload.policyReason,
        expectedVerification: payload.expectedVerification
      });
    }

    if (event.type === "AgentLeaseBudgetUpdated") {
      const payload = event.payload as LeaseBudgetItem;
      leaseBudget.set(payload.agentId, payload);
    }

    if (event.type === "BlockerRaised") {
      const payload = event.payload as BlockerItem;
      blockers.set(payload.blockerId, payload);
    }

    if (event.type === "HandoffRequested") {
      const payload = event.payload as HandoffItem;
      handoffs.set(payload.handoffId, payload);
    }

    if (event.type === "CommandQueued" || event.type === "CommandUpdated") {
      const payload = event.payload as CommandQueueItem;
      commandQueue.set(payload.commandId, payload);
    }

    if (event.type === "ApprovalRequested") {
      const payload = event.payload as ApprovalInboxProjectionItem;
      approvalInbox.set(payload.approvalId, payload);
    }

    if (event.type === "ApprovalDecided") {
      const approvalId = readString(event.payload, "approvalId");
      const existing = approvalId ? approvalInbox.get(approvalId) : undefined;
      if (approvalId && existing) {
        const decision = readString(event.payload, "decision");
        approvalInbox.set(approvalId, { ...existing, state: decision === "approve" ? "approved" : "rejected" });
      }
    }

    if (event.type === "ConflictDetected" || event.type === "ConflictEscalated") {
      const payload = event.payload as ConflictQueueItem;
      conflictQueue.set(payload.conflictId, payload);
    }

    if (event.type === "RecoveryQueued" || event.type === "RecoveryUpdated") {
      const payload = event.payload as RecoveryQueueItem;
      recoveryQueue.set(payload.recoveryId, payload);
    }

    if (event.type === "EditorSessionChanged") {
      editorSession = event.payload as EditorSessionProjection;
    }

    if (event.type === "DiffUpdated") {
      const payload = event.payload as DiffFileItem;
      diff.set(payload.path, payload);
    }

    if (event.type === "TerminalOutputAppended") {
      terminal.push(event.payload as TerminalOutputItem);
    }

    if (event.type === "ArtifactCreated") {
      const payload = event.payload as ArtifactProjectionItem;
      artifacts.set(payload.artifactId, payload);
    }

    if (event.type === "FinalReviewGateChanged") {
      finalReview = event.payload as FinalReviewGateProjection;
    }

    if (event.type === "NotificationRaised") {
      const payload = event.payload as NotificationInboxItem;
      notifications.set(payload.notificationId, payload);
    }
  });

  const firstRun = [...runs.values()][0];
  const lifecycle = buildLifecycle(firstRun);
  const serviceHealth = ([
    { service: "Gateway", state: "healthy", detail: "Realtime stream active", operatorOnly: false },
    { service: "Workspace Runtime", state: editorSession.state === "recovering" ? "recovering" : "healthy", detail: editorSession.message, operatorOnly: false },
    { service: "App-Server Adapter", state: "healthy", detail: "Protocol gate ready", operatorOnly: true },
    { service: "Orchestrator", state: "healthy", detail: "Lease loop ready", operatorOnly: true },
    { service: "Projection", state: "healthy", detail: `${events.length} events indexed`, operatorOnly: true },
    { service: "Worker saturation", state: "healthy", detail: "Normal", operatorOnly: true }
  ] satisfies readonly ServiceHealthProjectionItem[]).filter((item) => role === "operator" || !item.operatorOnly);

  const projection: ControlRoomProjectionResponse = {
    generatedAt: new Date().toISOString(),
    role,
    lastOffset: events.length,
    workspaces: [...workspaces.values()],
    repositories: [...repositories.values()],
    runs: [...runs.values()],
    lifecycle,
    agentHierarchy: [...agentHierarchy.values()],
    supervisorDecisions,
    agentContracts: [...agentContracts.values()],
    leaseBudget: [...leaseBudget.values()],
    blockers: [...blockers.values()],
    handoffs: [...handoffs.values()],
    commandQueue: [...commandQueue.values()],
    approvalInbox: [...approvalInbox.values()],
    conflictQueue: [...conflictQueue.values()],
    recoveryQueue: [...recoveryQueue.values()],
    timeline: timeline.slice(-250).reverse(),
    editorSession,
    fileTree: options.fileTree ?? [],
    diff: [...diff.values()],
    terminal: terminal.slice(-200),
    artifacts: [...artifacts.values()],
    serviceHealth,
    finalReview,
    notifications: [...notifications.values()],
    reconnect: { state: "connected", message: "실시간 연결이 활성화되어 있습니다." }
  };

  if (role !== "operator") {
    assertPublicResponseSafe(projection);
  }
  return projection;
}

export function rebuildMobileCommandReviewProjection(events: readonly DomainEvent[]): MobileCommandReviewProjectionResponse {
  const control = rebuildControlRoomProjection(events, { role: "user", fileTree: [] });
  const workspaceId = control.workspaces[0]?.workspaceId ?? "workspace_dev";
  const readNotifications = new Set<string>();
  let notificationSettings: MobileNotificationSettingsProjection = {
    workspaceId,
    enabled: true,
    approvals: true,
    recovery: true,
    finalReview: true,
    quietHeavyWork: true
  };
  let pushRegistration: MobilePushRegistrationProjection = {
    workspaceId,
    permission: "default",
    registered: false,
    routeOnClick: "/mobile#inbox"
  };

  for (const event of events) {
    if (event.type === "NotificationRead") {
      const notificationId = readString(event.payload, "notificationId");
      if (notificationId) readNotifications.add(notificationId);
    }
    if (event.type === "NotificationSettingsUpdated") {
      const payload = event.payload as NotificationSettingsRequest;
      notificationSettings = {
        workspaceId: payload.workspaceId,
        enabled: payload.enabled,
        approvals: payload.approvals,
        recovery: payload.recovery,
        finalReview: payload.finalReview,
        quietHeavyWork: payload.quietHeavyWork
      };
    }
    if (event.type === "MobilePushRegistrationChanged") {
      pushRegistration = {
        ...pushRegistration,
        ...(event.payload as MobilePushRegistrationProjection)
      };
    }
  }

  const inbox = control.notifications.map((item) => ({
    ...item,
    unread: item.unread && !readNotifications.has(item.notificationId)
  }));
  const projection: MobileCommandReviewProjectionResponse = {
    generatedAt: control.generatedAt,
    lastOffset: control.lastOffset,
    inbox,
    nextActions: buildMobileNextActions(control, inbox),
    runs: control.runs,
    agents: control.agentHierarchy,
    approvals: control.approvalInbox,
    conflicts: control.conflictQueue,
    recovery: control.recoveryQueue,
    diffSummary: summarizeDiffForMobile(control),
    finalReview: control.finalReview,
    serviceStatus: summarizeServiceForMobile(control),
    notificationSettings,
    pushRegistration,
    reconnect: control.reconnect
  };
  assertPublicResponseSafe(projection);
  return projection;
}

export function replayStreamFromOffset(events: readonly unknown[], afterOffset: number): readonly RealtimeFrame[] {
  return events.slice(afterOffset).map((event, index) => ({ offset: afterOffset + index + 1, event }));
}

export function assertPublicResponseSafe(value: unknown): void {
  const serialized = JSON.stringify(value);
  if (/(waiting_for_capacity|quota|backpressure|overload|queue position|password|token|credential|containerId)/i.test(serialized)) {
    throw new Error("Public response exposes internal resource control or secret detail");
  }
}

function sanitizePublicText(value: string): string {
  return value
    .replace(/waiting_for_capacity/g, "preparing")
    .replace(/quota/gi, "capacity")
    .replace(/backpressure/gi, "preparing")
    .replace(/overload/gi, "preparing");
}

function readString(value: unknown, key: string): string | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const entry = (value as Record<string, unknown>)[key];
  return typeof entry === "string" && entry.trim().length > 0 ? entry : undefined;
}

function labelEvent(type: string): string {
  const labels: Record<string, string> = {
    WorkspaceCatalogSeeded: "워크스페이스 준비",
    RunCreated: "작업 접수",
    RunObjectiveUpdated: "목표 설정",
    RunStateChanged: "진행 상태 변경",
    AgentTaskContractAccepted: "에이전트 계약",
    AgentHierarchyRecorded: "에이전트 배치",
    SupervisorDecisionRecorded: "Supervisor 판단",
    AgentLeaseBudgetUpdated: "작업 리스 갱신",
    CommandQueued: "명령 접수",
    CommandUpdated: "명령 진행",
    ApprovalRequested: "승인 요청",
    ApprovalDecided: "승인 처리",
    ConflictDetected: "충돌 감지",
    ConflictEscalated: "충돌 위임",
    RecoveryQueued: "복구 준비",
    RecoveryUpdated: "복구 진행",
    EditorSessionChanged: "IDE 세션",
    DiffUpdated: "Diff 갱신",
    TerminalOutputAppended: "터미널 출력",
    ArtifactCreated: "산출물 기록",
    FinalReviewGateChanged: "최종 검토",
    NotificationRaised: "알림"
  };
  return labels[type] ?? type;
}

function productDetail(event: DomainEvent): string {
  if (event.type === "RunStateChanged") {
    const to = readString(event.payload, "to") as RunState | undefined;
    return to ? productRunState(to) : "진행 상태가 갱신되었습니다.";
  }
  if (event.type === "CommandQueued" || event.type === "CommandUpdated") {
    return readString(event.payload, "instruction") ?? "명령이 처리되고 있습니다.";
  }
  if (event.type === "ApprovalRequested") {
    return readString(event.payload, "reason") ?? "승인이 필요합니다.";
  }
  if (event.type === "SupervisorDecisionRecorded") {
    return readString(event.payload, "selectedAction") ?? "Supervisor가 다음 단계를 선택했습니다.";
  }
  return labelEvent(event.type);
}

function productRunState(state: RunState): string {
  const labels: Record<RunState, string> = {
    draft: "작업 접수 중",
    queued: "작업 접수 완료",
    waiting_for_capacity: "작업 준비 중",
    planning: "분석 진행 중",
    planned: "실행 계획 준비",
    assigning: "에이전트 배치 중",
    preparing_workspace: "워크스페이스 준비 중",
    binding_app_server: "Agent 세션 연결 중",
    running: "실행 중",
    waiting_for_input: "사용자 입력 필요",
    waiting_for_approval: "승인 필요",
    blocked: "확인 필요",
    recovering: "복구 중",
    verifying: "검증 중",
    ready_for_review: "최종 검토 준비",
    integrating: "통합 중",
    completed: "완료",
    failed: "실패",
    cancelled: "취소됨"
  };
  return labels[state];
}

function mapRunStateToStep(state: RunState): Pick<RunSummary, "userStatus" | "currentStep" | "progressPercent"> {
  const userStatus = mapInternalRunStateToUserStatus(state);
  if (state === "queued" || state === "draft") return { userStatus, currentStep: "accepted", progressPercent: 12 };
  if (state === "planning" || state === "planned") return { userStatus, currentStep: "analyzing", progressPercent: 28 };
  if (state === "assigning" || state === "preparing_workspace" || state === "binding_app_server" || state === "waiting_for_capacity") {
    return { userStatus, currentStep: "preparing", progressPercent: 42 };
  }
  if (state === "running" || state === "waiting_for_input" || state === "blocked" || state === "recovering") {
    return { userStatus, currentStep: "executing", progressPercent: state === "recovering" ? 58 : 64 };
  }
  if (state === "waiting_for_approval" || state === "verifying" || state === "ready_for_review" || state === "integrating") {
    return { userStatus, currentStep: "reviewing", progressPercent: state === "integrating" ? 88 : 76 };
  }
  return { userStatus, currentStep: "complete", progressPercent: state === "completed" ? 100 : 0 };
}

function buildLifecycle(run: RunSummary | undefined): readonly LifecycleStep[] {
  const steps: ReadonlyArray<[LifecycleStep["id"], LifecycleStep["label"], RunSummary["currentStep"]]> = [
    ["accepted", "접수", "accepted"],
    ["analyzing", "분석", "analyzing"],
    ["preparing", "준비", "preparing"],
    ["executing", "실행", "executing"],
    ["reviewing", "검토", "reviewing"],
    ["complete", "완료", "complete"]
  ];
  const activeIndex = run ? steps.findIndex((step) => step[2] === run.currentStep) : -1;
  return steps.map((step, index) => ({
    id: step[0],
    label: step[1],
    state: activeIndex === -1 ? "upcoming" : index < activeIndex ? "done" : index === activeIndex ? "active" : "upcoming"
  }));
}

function buildMobileNextActions(control: ControlRoomProjectionResponse, inbox: readonly NotificationInboxItem[]): readonly MobileNextActionItem[] {
  const actions: MobileNextActionItem[] = [];
  for (const approval of control.approvalInbox.filter((item) => item.state === "requested")) {
    const action: MobileNextActionItem = {
      actionId: approval.approvalId,
      kind: "approval",
      title: approval.destructive ? "확인 후 승인" : "승인 검토",
      body: approval.reason,
      route: `#approval-${approval.approvalId}`,
      priority: approval.destructive ? "critical" : "normal",
      destructive: approval.destructive
    };
    if (approval.runId) (action as { runId: string }).runId = approval.runId;
    if (approval.destructive) (action as { confirmationLabel: string }).confirmationLabel = "승인 전 확인";
    actions.push(action);
  }
  for (const conflict of control.conflictQueue.filter((item) => item.state === "detected")) {
    actions.push({
      actionId: conflict.conflictId,
      kind: "conflict",
      title: "충돌 검토",
      body: conflict.summary,
      route: `#conflict-${conflict.conflictId}`,
      priority: "normal",
      destructive: false,
      runId: conflict.runId
    });
  }
  for (const recovery of control.recoveryQueue.filter((item) => item.state !== "resolved")) {
    actions.push({
      actionId: recovery.recoveryId,
      kind: "recovery",
      title: recovery.title,
      body: recovery.nextAction,
      route: `#recovery-${recovery.recoveryId}`,
      priority: recovery.state === "recovering" ? "critical" : "normal",
      destructive: false,
      runId: recovery.runId
    });
  }
  if (control.finalReview.runId && (control.finalReview.state === "ready" || control.finalReview.state === "changes_requested")) {
    actions.push({
      actionId: `final_${control.finalReview.runId}`,
      kind: "final_review",
      title: "최종 검토",
      body: control.finalReview.state === "ready" ? "검증 결과를 확인하고 최종 승인할 수 있습니다." : "변경 요청 반영 여부를 확인하십시오.",
      route: "#final-review",
      priority: "normal",
      destructive: false,
      runId: control.finalReview.runId
    });
  }
  for (const notification of inbox.filter((item) => item.unread)) {
    actions.push({
      actionId: notification.notificationId,
      kind: "notification",
      title: notification.title,
      body: notification.body,
      route: notification.route,
      priority: "low",
      destructive: false
    });
  }
  if (!actions.length && control.runs[0]) {
    actions.push({
      actionId: control.runs[0].runId,
      kind: "run",
      title: "진행 상태 확인",
      body: control.runs[0].objective,
      route: "#run-detail",
      priority: "low",
      destructive: false,
      runId: control.runs[0].runId
    });
  }
  const priorityRank: Record<MobileNextActionItem["priority"], number> = { critical: 0, normal: 1, low: 2 };
  return actions.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]).slice(0, 10);
}

function summarizeDiffForMobile(control: ControlRoomProjectionResponse): MobileDiffSummary {
  const files = control.diff;
  const hunks = files.flatMap((file) => file.hunks.map((hunk) => ({ path: file.path, hunkId: hunk.hunkId, title: hunk.title, state: hunk.state })));
  const terminalText = control.terminal.map((item) => item.text).join("\n").toLowerCase();
  const hasPendingTest = control.artifacts.some((item) => item.label.includes("테스트") && item.sizeLabel === "pending");
  const testStatus: MobileDiffSummary["testStatus"] = hasPendingTest ? "pending" : terminalText.includes("failed") ? "needs_review" : terminalText.includes("passed") ? "passed" : "unknown";
  return {
    fileCount: files.length,
    hunkCount: hunks.length,
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    riskyFiles: files.map((file) => file.path).filter((file) => /(server|infra|docker|security|gateway)/i.test(file)).slice(0, 5),
    testStatus,
    hunks
  };
}

function summarizeServiceForMobile(control: ControlRoomProjectionResponse): MobileServiceStatusProjection {
  const workspace = control.workspaces[0];
  const runtime = control.serviceHealth.find((item) => item.service === "Workspace Runtime");
  return {
    realtime: control.reconnect.state,
    workspace: workspace?.status ?? "stopped",
    message: control.reconnect.message,
    workspaceMessage: runtime?.detail ?? "워크스페이스 상태를 확인하고 있습니다."
  };
}

function contractToProjection(contract: AgentTaskContract): AgentContractItem {
  return {
    contractId: contract.id,
    agentId: `agent_${contract.id}`,
    runId: contract.parentRunId,
    objective: contract.objective,
    workScope: `${contract.workScope.workspaceId}:${contract.workScope.rootPath}`,
    ownedFiles: contract.ownedFiles,
    forbiddenFiles: contract.forbiddenFiles,
    budget: {
      commands: contract.commandBudget,
      retries: contract.retryBudget,
      wallClockMinutes: Math.round(contract.wallClockBudgetMs / 60000)
    },
    verification: contract.verificationCommands,
    escalationRule: contract.escalationTriggers
  };
}

export function mapCommandIntentToResourceClass(intent: CommandResourceIntent): ResourceClass {
  if (intent === "test") return "test";
  if (intent === "build") return "build";
  if (intent === "long_running") return "long_running";
  return "interactive";
}
