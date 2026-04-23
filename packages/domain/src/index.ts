import type {
  ActorRef,
  AgentState,
  CommandState,
  DomainEvent as CoreDomainEvent,
  RunState
} from "@nadovibe/core-kernel";
import { COMMAND_TRANSITIONS, RUN_TRANSITIONS, transitionState } from "@nadovibe/core-kernel";

export type {
  AgentState,
  AgentTaskContract,
  CapacityReservation,
  CommandState,
  DomainEvent,
  IdentitySeedRecord,
  RunRecord,
  RunState,
  SupervisorDecision,
  WorkScope,
  WorkspaceEditorSession
} from "@nadovibe/core-kernel";

export type ServiceBoundary =
  | "gateway"
  | "core-control-plane"
  | "app-server-adapter"
  | "orchestrator"
  | "workspace-runtime"
  | "projection-worker"
  | "web";

export interface ServiceHealth {
  readonly ok: boolean;
  readonly service: ServiceBoundary;
  readonly dependency: "core" | "projection" | "runtime" | "static";
}

export const REQUIRED_DOMAIN_MODELS = [
  "Tenant",
  "User",
  "Membership",
  "Workspace",
  "Repository",
  "WorkspaceRuntime",
  "AppServerConnection",
  "AppServerSchemaVersion",
  "AppServerSession",
  "AppServerThread",
  "AppServerTurn",
  "AppServerItem",
  "AppServerNotificationOffset",
  "AppServerApprovalMirror",
  "AppServerRateLimitMirror",
  "Thread",
  "Run",
  "Agent",
  "AgentTaskContract",
  "AgentWorkItem",
  "AgentLease",
  "AgentBudget",
  "ResourcePool",
  "TenantQuota",
  "UserQuota",
  "WorkspaceQuota",
  "CapacityReservation",
  "RunQueueSlot",
  "CommandResourceClass",
  "OverloadSignal",
  "SupervisorDecision",
  "SupervisorCheckpoint",
  "WorkScope",
  "FileLease",
  "Command",
  "ApprovalRequest",
  "Conflict",
  "Integration",
  "Artifact",
  "Checkpoint",
  "Notification",
  "AuditEvent"
] as const;

export type RequiredDomainModelName = (typeof REQUIRED_DOMAIN_MODELS)[number];
export type ApprovalState = "requested" | "visible" | "approved" | "rejected" | "expired" | "superseded";
export type AgentWorkItemState =
  | "proposed"
  | "accepted"
  | "leased"
  | "in_progress"
  | "needs_input"
  | "needs_approval"
  | "blocked"
  | "handoff_requested"
  | "verifying"
  | "reported"
  | "accepted_by_supervisor"
  | "rejected_by_supervisor"
  | "cancelled";
export type WorkspaceRuntimeState = "provisioning" | "ready" | "busy" | "capacity_blocked" | "recovering" | "draining" | "stopped" | "failed";
export type AppServerSessionState = "creating" | "connected" | "reattaching" | "recovering" | "draining" | "closed" | "failed";

export interface DomainModelBase<TState extends string = string> {
  readonly id: string;
  readonly tenantId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly actor: ActorRef;
  readonly version: number;
  readonly lifecycleState: TState;
}

export interface Tenant extends DomainModelBase<"active" | "suspended"> {
  readonly name: string;
}

export interface User extends DomainModelBase<"active" | "disabled"> {
  readonly displayName: string;
}

export interface Membership extends DomainModelBase<"active" | "revoked"> {
  readonly userId: string;
  readonly role: "owner" | "admin" | "member" | "viewer";
}

export interface Workspace extends DomainModelBase<"created" | "ready" | "archived"> {
  readonly repositoryId: string;
}

export interface Repository extends DomainModelBase<"connected" | "syncing" | "failed" | "archived"> {
  readonly defaultBranch: string;
  readonly remoteUrlRedacted: string;
}

export interface WorkspaceRuntime extends DomainModelBase<WorkspaceRuntimeState> {
  readonly workspaceId: string;
  readonly sandboxContainerId?: string;
}

export interface AppServerConnection extends DomainModelBase<"created" | "initialized" | "closed" | "failed"> {
  readonly serviceName: string;
}

export interface AppServerSchemaVersion extends DomainModelBase<"registered" | "rejected"> {
  readonly codexVersion: string;
  readonly methodCount: number;
}

export interface AppServerSession extends DomainModelBase<AppServerSessionState> {
  readonly connectionId: string;
  readonly runId: string;
}

export interface AppServerThread extends DomainModelBase<"created" | "loaded" | "archived" | "closed"> {
  readonly appServerThreadId: string;
}

export interface AppServerTurn extends DomainModelBase<"created" | "running" | "interrupted" | "completed" | "failed"> {
  readonly appServerTurnId: string;
}

export interface AppServerItem extends DomainModelBase<"started" | "completed" | "failed"> {
  readonly itemType: string;
}

export interface AppServerNotificationOffset extends DomainModelBase<"active" | "reset"> {
  readonly connectionId: string;
  readonly offset: number;
}

export interface AppServerApprovalMirror extends DomainModelBase<ApprovalState> {
  readonly approvalRequestId: string;
}

export interface AppServerRateLimitMirror extends DomainModelBase<"normal" | "limited"> {
  readonly resetAt?: string;
}

export interface Thread extends DomainModelBase<"created" | "active" | "archived"> {
  readonly runId: string;
}

export interface Agent extends DomainModelBase<AgentState> {
  readonly parentAgentId?: string;
  readonly runId: string;
}

export interface AgentWorkItem extends DomainModelBase<AgentWorkItemState> {
  readonly agentId: string;
  readonly workScopeId: string;
}

export interface Command extends DomainModelBase<CommandState> {
  readonly commandName: string;
  readonly resourceClass: string;
}

export interface ApprovalRequest extends DomainModelBase<ApprovalState> {
  readonly reason: string;
  readonly destructive: boolean;
}

export interface Conflict extends DomainModelBase<"detected" | "assigned" | "resolved" | "cancelled"> {
  readonly files: readonly string[];
}

export interface Integration extends DomainModelBase<"preparing" | "applying" | "verifying" | "completed" | "failed"> {
  readonly runId: string;
}

export interface Artifact extends DomainModelBase<"created" | "sealed" | "expired"> {
  readonly uri: string;
  readonly contentType: string;
}

export interface Checkpoint extends DomainModelBase<"created" | "compacted" | "restored"> {
  readonly aggregateId: string;
  readonly aggregateVersion: number;
}

export interface Notification extends DomainModelBase<"created" | "visible" | "read" | "expired"> {
  readonly targetUserId: string;
}

export interface AuditEvent extends DomainModelBase<"recorded"> {
  readonly eventType: string;
}

export const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalState, readonly ApprovalState[]>> = {
  requested: ["visible", "expired", "superseded"],
  visible: ["approved", "rejected", "expired", "superseded"],
  approved: [],
  rejected: [],
  expired: [],
  superseded: []
};

export const AGENT_WORK_ITEM_TRANSITIONS: Readonly<Record<AgentWorkItemState, readonly AgentWorkItemState[]>> = {
  proposed: ["accepted", "cancelled"],
  accepted: ["leased", "needs_input", "needs_approval", "cancelled"],
  leased: ["in_progress", "blocked", "cancelled"],
  in_progress: ["needs_input", "needs_approval", "blocked", "handoff_requested", "verifying", "cancelled"],
  needs_input: ["in_progress", "cancelled"],
  needs_approval: ["in_progress", "blocked", "cancelled"],
  blocked: ["in_progress", "handoff_requested", "cancelled"],
  handoff_requested: ["cancelled"],
  verifying: ["reported", "blocked", "cancelled"],
  reported: ["accepted_by_supervisor", "rejected_by_supervisor"],
  accepted_by_supervisor: [],
  rejected_by_supervisor: ["accepted", "cancelled"],
  cancelled: []
};

export const WORKSPACE_RUNTIME_TRANSITIONS: Readonly<Record<WorkspaceRuntimeState, readonly WorkspaceRuntimeState[]>> = {
  provisioning: ["ready", "recovering", "failed"],
  ready: ["busy", "draining", "stopped", "failed"],
  busy: ["ready", "capacity_blocked", "recovering", "draining", "failed"],
  capacity_blocked: ["ready", "draining", "failed"],
  recovering: ["ready", "failed", "stopped"],
  draining: ["stopped", "ready"],
  stopped: ["provisioning"],
  failed: ["recovering"]
};

export const APP_SERVER_SESSION_TRANSITIONS: Readonly<Record<AppServerSessionState, readonly AppServerSessionState[]>> = {
  creating: ["connected", "failed"],
  connected: ["reattaching", "recovering", "draining", "closed", "failed"],
  reattaching: ["connected", "recovering", "failed"],
  recovering: ["connected", "failed", "closed"],
  draining: ["closed", "failed"],
  closed: ["reattaching"],
  failed: ["recovering", "closed"]
};

export const DOMAIN_STATE_MACHINES = {
  run: RUN_TRANSITIONS,
  command: COMMAND_TRANSITIONS,
  approval: APPROVAL_TRANSITIONS,
  agentWorkItem: AGENT_WORK_ITEM_TRANSITIONS,
  workspaceRuntime: WORKSPACE_RUNTIME_TRANSITIONS,
  appServerSession: APP_SERVER_SESSION_TRANSITIONS
} as const;

export function transitionDomainState<TState extends string>(
  transitions: Readonly<Record<TState, readonly TState[]>>,
  current: TState,
  next: TState
): TState {
  return transitionState(transitions, current, next);
}

export function assertSameTenantReferences(...models: readonly DomainModelBase[]): void {
  const first = models[0];
  if (!first) {
    return;
  }
  for (const model of models.slice(1)) {
    if (model.tenantId !== first.tenantId) {
      throw new Error(`Cross-tenant reference denied: ${first.id}(${first.tenantId}) -> ${model.id}(${model.tenantId})`);
    }
  }
}

export interface RunTimelineItem {
  readonly eventId: string;
  readonly runId: string;
  readonly type: string;
  readonly timestamp: string;
  readonly summary: string;
}

export interface AgentRosterItem {
  readonly contractId: string;
  readonly runId: string;
  readonly objective: string;
  readonly state: "contracted";
}

export interface ApprovalInboxItem {
  readonly approvalId: string;
  readonly runId?: string;
  readonly state: ApprovalState;
  readonly reason: string;
}

export interface WorkspaceStatusReadModel {
  readonly workspaceId: string;
  readonly state: WorkspaceRuntimeState | "unknown";
}

export interface ResourceReadModel {
  readonly reservations: number;
  readonly overloadSignals: number;
}

export interface PlatformReadModels {
  readonly timeline: readonly RunTimelineItem[];
  readonly agentRoster: readonly AgentRosterItem[];
  readonly approvalInbox: readonly ApprovalInboxItem[];
  readonly workspaceStatus: readonly WorkspaceStatusReadModel[];
  readonly resources: ResourceReadModel;
}

export function rebuildPlatformReadModels(events: readonly CoreDomainEvent[]): PlatformReadModels {
  const timeline: RunTimelineItem[] = [];
  const agentRoster: AgentRosterItem[] = [];
  const approvalInbox: ApprovalInboxItem[] = [];
  const workspaceStatus = new Map<string, WorkspaceStatusReadModel>();
  let reservations = 0;
  let overloadSignals = 0;

  for (const event of events) {
    if (event.aggregateType === "Run") {
      timeline.push({
        eventId: event.id,
        runId: event.aggregateId,
        type: event.type,
        timestamp: event.metadata.timestamp,
        summary: summarizeEvent(event)
      });
    }
    if (event.type === "AgentTaskContractAccepted") {
      const payload = event.payload as { id: string; parentRunId: string; objective: string };
      agentRoster.push({ contractId: payload.id, runId: payload.parentRunId, objective: payload.objective, state: "contracted" });
    }
    if (event.type === "ApprovalRequested") {
      const payload = event.payload as { approvalId: string; runId?: string; reason: string };
      approvalInbox.push(
        payload.runId === undefined
          ? { approvalId: payload.approvalId, reason: payload.reason, state: "requested" }
          : { approvalId: payload.approvalId, runId: payload.runId, reason: payload.reason, state: "requested" }
      );
    }
    if (event.type === "WorkspaceRuntimeStateChanged") {
      const payload = event.payload as { workspaceId: string; to: WorkspaceRuntimeState };
      workspaceStatus.set(payload.workspaceId, { workspaceId: payload.workspaceId, state: payload.to });
    }
    if (event.type === "CapacityReservationGranted") {
      reservations += 1;
    }
    if (event.type === "OverloadSignalRaised") {
      overloadSignals += 1;
    }
  }

  return {
    timeline,
    agentRoster,
    approvalInbox,
    workspaceStatus: [...workspaceStatus.values()],
    resources: { reservations, overloadSignals }
  };
}

export interface CheckpointArtifactMetadata {
  readonly checkpointId: string;
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly artifactUri: string;
  readonly createdAt: string;
}

export type FailureClass = "retryable_runtime" | "policy_denied" | "capacity_wait" | "fatal";

export function classifyFailure(reason: string): FailureClass {
  if (/capacity|quota|overload/i.test(reason)) return "capacity_wait";
  if (/policy|denied|approval/i.test(reason)) return "policy_denied";
  if (/restart|reattach|timeout|recover/i.test(reason)) return "retryable_runtime";
  return "fatal";
}

function summarizeEvent(event: CoreDomainEvent): string {
  if (event.type === "RunStateChanged") {
    const payload = event.payload as { from: string; to: string };
    return `${payload.from} -> ${payload.to}`;
  }
  return event.type;
}
