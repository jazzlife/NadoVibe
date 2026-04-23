export * from "@nadovibe/core-agent";
export * from "@nadovibe/core-events";
export * from "@nadovibe/core-protocol";
export * from "@nadovibe/core-resource";
export * from "@nadovibe/core-security";
export * from "@nadovibe/core-workspace";

import type { AgentTaskContract, SupervisorDecision } from "@nadovibe/core-agent";
import { validateAgentTaskContract } from "@nadovibe/core-agent";
import { InMemoryEventJournal, InMemoryIdempotencyStore, type ActorRef, type DomainEvent, type EventJournal } from "@nadovibe/core-events";
import { CapacityAdmissionController, type ResourceClass } from "@nadovibe/core-resource";

export type RunState =
  | "draft"
  | "queued"
  | "waiting_for_capacity"
  | "planning"
  | "planned"
  | "assigning"
  | "preparing_workspace"
  | "binding_app_server"
  | "running"
  | "waiting_for_input"
  | "waiting_for_approval"
  | "blocked"
  | "recovering"
  | "verifying"
  | "ready_for_review"
  | "integrating"
  | "completed"
  | "failed"
  | "cancelled";

export type CommandState =
  | "received"
  | "deduplicated"
  | "authorized"
  | "queued"
  | "waiting_for_capacity"
  | "dispatching"
  | "dispatched"
  | "acknowledged"
  | "rejected"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentState =
  | "created"
  | "contracted"
  | "assigned"
  | "working"
  | "waiting"
  | "blocked"
  | "handoff_requested"
  | "recovering"
  | "verifying"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly state: RunState;
  readonly version: number;
  readonly supervisorDecisionId?: string;
}

export interface IdentitySeedRecord {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly membershipRole: "owner" | "admin" | "member" | "viewer";
  readonly createdThrough: "core-command-api";
}

export interface CoreCommandContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly actor: ActorRef;
  readonly sourceService: string;
}

export interface CreateRunCommand {
  readonly idempotencyKey: string;
  readonly runId: string;
  readonly workspaceId: string;
}

export interface SeedIdentityCommand {
  readonly idempotencyKey: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly membershipRole: "owner" | "admin" | "member" | "viewer";
}

export interface TransitionRunCommand {
  readonly runId: string;
  readonly to: RunState;
}

export class CoreInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoreInvariantError";
  }
}

export const RUN_TRANSITIONS: Readonly<Record<RunState, readonly RunState[]>> = {
  draft: ["queued", "cancelled"],
  queued: ["waiting_for_capacity", "planning", "cancelled"],
  waiting_for_capacity: ["planning", "cancelled"],
  planning: ["planned", "blocked", "recovering", "cancelled"],
  planned: ["assigning", "cancelled"],
  assigning: ["preparing_workspace", "blocked", "cancelled"],
  preparing_workspace: ["binding_app_server", "recovering", "failed", "cancelled"],
  binding_app_server: ["running", "recovering", "failed", "cancelled"],
  running: ["waiting_for_input", "waiting_for_approval", "blocked", "recovering", "verifying", "cancelled"],
  waiting_for_input: ["running", "cancelled"],
  waiting_for_approval: ["running", "blocked", "cancelled"],
  blocked: ["running", "recovering", "cancelled", "failed"],
  recovering: ["running", "blocked", "failed", "cancelled"],
  verifying: ["ready_for_review", "running", "failed", "cancelled"],
  ready_for_review: ["integrating", "running", "cancelled"],
  integrating: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["recovering"],
  cancelled: []
};

export const COMMAND_TRANSITIONS: Readonly<Record<CommandState, readonly CommandState[]>> = {
  received: ["deduplicated", "authorized", "rejected"],
  deduplicated: ["completed"],
  authorized: ["queued", "waiting_for_capacity", "dispatching", "rejected"],
  queued: ["waiting_for_capacity", "dispatching", "cancelled"],
  waiting_for_capacity: ["queued", "dispatching", "cancelled"],
  dispatching: ["dispatched", "failed", "cancelled"],
  dispatched: ["acknowledged", "failed", "cancelled"],
  acknowledged: ["completed", "failed"],
  rejected: [],
  completed: [],
  failed: [],
  cancelled: []
};

export function transitionState<TState extends string>(
  transitions: Readonly<Record<TState, readonly TState[]>>,
  current: TState,
  next: TState
): TState {
  if (!transitions[current]?.includes(next)) {
    throw new CoreInvariantError(`Invalid transition ${current} -> ${next}`);
  }
  return next;
}

export class CoreControlPlane {
  readonly events: EventJournal;
  readonly idempotency: InMemoryIdempotencyStore;
  readonly capacity: CapacityAdmissionController;
  private readonly runs = new Map<string, RunRecord>();
  private readonly identitySeeds = new Map<string, IdentitySeedRecord>();
  private readonly supervisorDecisions = new Map<string, SupervisorDecision>();

  constructor(input?: {
    readonly events?: EventJournal;
    readonly idempotency?: InMemoryIdempotencyStore;
    readonly capacity?: CapacityAdmissionController;
  }) {
    this.events = input?.events ?? new InMemoryEventJournal();
    this.idempotency = input?.idempotency ?? new InMemoryIdempotencyStore();
    this.capacity = input?.capacity ?? new CapacityAdmissionController();
  }

  seedIdentity(command: SeedIdentityCommand, context: CoreCommandContext): IdentitySeedRecord {
    const cached = this.idempotency.get<IdentitySeedRecord>(command.idempotencyKey);
    if (cached) {
      return cached.result;
    }
    if (command.tenantId !== context.tenantId || command.userId !== context.userId) {
      throw new CoreInvariantError("Seed identity must match Core command context");
    }
    const seed: IdentitySeedRecord = {
      tenantId: command.tenantId,
      userId: command.userId,
      workspaceId: command.workspaceId,
      repositoryId: command.repositoryId,
      membershipRole: command.membershipRole,
      createdThrough: "core-command-api"
    };
    this.events.append(
      {
        aggregateId: command.tenantId,
        aggregateType: "Tenant",
        type: "TenantUserWorkspaceSeeded",
        schemaVersion: 1,
        payload: seed,
        metadata: metadata(context)
      },
      this.events.readAggregate(command.tenantId).at(-1)?.aggregateVersion ?? 0
    );
    this.identitySeeds.set(`${seed.tenantId}:${seed.userId}:${seed.workspaceId}`, seed);
    this.idempotency.put({
      key: command.idempotencyKey,
      commandName: "seedIdentity",
      requestHash: `${command.tenantId}:${command.userId}:${command.workspaceId}:${command.repositoryId}`,
      result: seed
    });
    return seed;
  }

  createRun(command: CreateRunCommand, context: CoreCommandContext): RunRecord {
    const cached = this.idempotency.get<RunRecord>(command.idempotencyKey);
    if (cached) {
      return cached.result;
    }
    if (this.runs.has(command.runId)) {
      throw new CoreInvariantError(`Run already exists: ${command.runId}`);
    }
    const run: RunRecord = {
      id: command.runId,
      tenantId: context.tenantId,
      workspaceId: command.workspaceId,
      state: "draft",
      version: 1
    };
    this.events.append(
      {
        aggregateId: command.runId,
        aggregateType: "Run",
        type: "RunCreated",
        schemaVersion: 1,
        payload: run,
        metadata: metadata(context)
      },
      0
    );
    this.runs.set(run.id, run);
    this.idempotency.put({
      key: command.idempotencyKey,
      commandName: "createRun",
      requestHash: `${command.runId}:${command.workspaceId}`,
      result: run
    });
    return run;
  }

  transitionRun(command: TransitionRunCommand, context: CoreCommandContext): RunRecord {
    const current = this.requireRun(command.runId);
    const nextState = transitionState(RUN_TRANSITIONS, current.state, command.to);
    const next: RunRecord = { ...current, state: nextState, version: current.version + 1 };
    this.events.append(
      {
        aggregateId: command.runId,
        aggregateType: "Run",
        type: "RunStateChanged",
        schemaVersion: 1,
        payload: { from: current.state, to: nextState },
        metadata: metadata(context)
      },
      current.version
    );
    this.events.append(
      {
        aggregateId: `audit_${command.runId}_${next.version}`,
        aggregateType: "AuditEvent",
        type: "StateTransitionAudited",
        schemaVersion: 1,
        payload: { aggregateId: command.runId, from: current.state, to: nextState },
        metadata: metadata(context)
      },
      0
    );
    this.runs.set(command.runId, next);
    return next;
  }

  recordSupervisorDecision(decision: SupervisorDecision, context: CoreCommandContext): SupervisorDecision {
    if (decision.observedState.trim() === "" || decision.selectedAction.trim() === "" || decision.expectedVerification.length === 0) {
      throw new CoreInvariantError("SupervisorDecision must include observed state, action, reason, and expected verification");
    }
    this.supervisorDecisions.set(decision.id, decision);
    this.events.append(
      {
        aggregateId: decision.runId,
        aggregateType: "Run",
        type: "SupervisorDecisionRecorded",
        schemaVersion: 1,
        payload: decision,
        metadata: metadata(context)
      },
      this.requireRun(decision.runId).version
    );
    const current = this.requireRun(decision.runId);
    this.runs.set(decision.runId, { ...current, supervisorDecisionId: decision.id, version: current.version + 1 });
    return decision;
  }

  completeRun(runId: string, supervisorDecisionId: string | undefined, context: CoreCommandContext): RunRecord {
    if (!supervisorDecisionId || !this.supervisorDecisions.has(supervisorDecisionId)) {
      throw new CoreInvariantError("Run completion requires SupervisorDecision");
    }
    const current = this.requireRun(runId);
    if (current.state !== "integrating") {
      throw new CoreInvariantError("Run must be integrating before completion");
    }
    return this.transitionRun({ runId, to: "completed" }, context);
  }

  startAgentWork(contract: AgentTaskContract | undefined, context: CoreCommandContext): void {
    if (!contract) {
      throw new CoreInvariantError("Agent work requires AgentTaskContract");
    }
    validateAgentTaskContract(contract);
    this.events.append(
      {
        aggregateId: contract.id,
        aggregateType: "AgentTaskContract",
        type: "AgentTaskContractAccepted",
        schemaVersion: 1,
        payload: contract,
        metadata: metadata(context)
      },
      0
    );
  }

  dispatchCommand(resourceClass: ResourceClass, reservationId: string | undefined, now: number): CommandState {
    this.capacity.assertCanDispatch(resourceClass, reservationId, now);
    return "dispatching";
  }

  replay(events: readonly DomainEvent[]): void {
    this.runs.clear();
    this.identitySeeds.clear();
    this.supervisorDecisions.clear();
    for (const event of events) {
      if (event.aggregateType === "Tenant" && event.type === "TenantUserWorkspaceSeeded") {
        const seed = event.payload as IdentitySeedRecord;
        this.identitySeeds.set(`${seed.tenantId}:${seed.userId}:${seed.workspaceId}`, seed);
      }
      if (event.aggregateType === "Run" && event.type === "RunCreated") {
        const run = event.payload as RunRecord;
        this.runs.set(run.id, run);
      }
      if (event.aggregateType === "Run" && event.type === "RunStateChanged") {
        const run = this.requireRun(event.aggregateId);
        const payload = event.payload as { to: RunState };
        this.runs.set(event.aggregateId, { ...run, state: payload.to, version: event.aggregateVersion });
      }
      if (event.aggregateType === "Run" && event.type === "SupervisorDecisionRecorded") {
        const decision = event.payload as SupervisorDecision;
        this.supervisorDecisions.set(decision.id, decision);
        const run = this.requireRun(decision.runId);
        this.runs.set(decision.runId, { ...run, supervisorDecisionId: decision.id, version: event.aggregateVersion });
      }
    }
  }

  getRun(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  getIdentitySeed(tenantId: string, userId: string, workspaceId: string): IdentitySeedRecord | undefined {
    return this.identitySeeds.get(`${tenantId}:${userId}:${workspaceId}`);
  }

  private requireRun(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) {
      throw new CoreInvariantError(`Unknown run ${runId}`);
    }
    return run;
  }
}

function metadata(context: CoreCommandContext) {
  return {
    tenantId: context.tenantId,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId,
    sourceService: context.sourceService,
    actor: context.actor
  };
}
