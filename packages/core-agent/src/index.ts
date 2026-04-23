import type { ResourceClass } from "@nadovibe/core-resource";

export interface WorkScopeRef {
  readonly workspaceId: string;
  readonly rootPath: string;
  readonly allowedPaths: readonly string[];
}

export interface AgentTaskContract {
  readonly id: string;
  readonly parentRunId: string;
  readonly parentAgentId?: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly branch: string;
  readonly objective: string;
  readonly allowedTools: readonly string[];
  readonly ownedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly workScope: WorkScopeRef;
  readonly commandBudget: number;
  readonly tokenBudget: number;
  readonly retryBudget: number;
  readonly wallClockBudgetMs: number;
  readonly resourceClass: ResourceClass;
  readonly requiresCapacityReservation: boolean;
  readonly dependencies: readonly string[];
  readonly outputSchema: Record<string, unknown>;
  readonly verificationCommands: readonly string[];
  readonly escalationTriggers: readonly string[];
  readonly cancellationToken: string;
  readonly heartbeatIntervalMs: number;
  readonly doneCriteria: readonly string[];
}

export interface AgentLease {
  readonly id: string;
  readonly contractId: string;
  readonly agentId: string;
  readonly expiresAt: number;
  readonly revokedAt?: number;
}

export interface AgentBudget {
  readonly commandLimit: number;
  readonly retryLimit: number;
  readonly toolExecutionLimit: number;
  readonly tokenLimit: number;
  readonly wallClockLimitMs: number;
}

export interface AgentBudgetUsage {
  readonly commands: number;
  readonly retries: number;
  readonly toolExecutions: number;
  readonly tokens: number;
  readonly wallClockMs: number;
}

export interface SupervisorDecision {
  readonly id: string;
  readonly runId: string;
  readonly observedState: string;
  readonly selectedAction: string;
  readonly policyReason: string;
  readonly affectedAgents: readonly string[];
  readonly expectedVerification: readonly string[];
}

export class AgentContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentContractError";
  }
}

export function validateAgentTaskContract(contract: AgentTaskContract): void {
  const requiredStrings: Array<[string, string]> = [
    ["id", contract.id],
    ["parentRunId", contract.parentRunId],
    ["tenantId", contract.tenantId],
    ["workspaceId", contract.workspaceId],
    ["repositoryId", contract.repositoryId],
    ["branch", contract.branch],
    ["objective", contract.objective],
    ["cancellationToken", contract.cancellationToken]
  ];
  for (const [field, value] of requiredStrings) {
    if (value.trim().length === 0) {
      throw new AgentContractError(`AgentTaskContract.${field} is required`);
    }
  }
  if (contract.allowedTools.length === 0) {
    throw new AgentContractError("AgentTaskContract.allowedTools is required");
  }
  if (contract.doneCriteria.length === 0) {
    throw new AgentContractError("AgentTaskContract.doneCriteria is required");
  }
  if (contract.verificationCommands.length === 0) {
    throw new AgentContractError("AgentTaskContract.verificationCommands is required");
  }
  if (contract.commandBudget <= 0 || contract.retryBudget < 0 || contract.wallClockBudgetMs <= 0) {
    throw new AgentContractError("AgentTaskContract budgets are invalid");
  }
  for (const file of contract.ownedFiles) {
    if (contract.forbiddenFiles.includes(file)) {
      throw new AgentContractError(`File cannot be both owned and forbidden: ${file}`);
    }
  }
}

export function assertLeaseActive(lease: AgentLease, now: number): void {
  if (lease.revokedAt !== undefined) {
    throw new AgentContractError("AgentLease is revoked");
  }
  if (lease.expiresAt <= now) {
    throw new AgentContractError("AgentLease is expired");
  }
}

export class AgentBudgetTracker {
  constructor(private readonly budget: AgentBudget, private usage: AgentBudgetUsage) {}

  assertToolExecutionAllowed(): void {
    if (this.usage.toolExecutions >= this.budget.toolExecutionLimit) {
      throw new AgentContractError("AgentBudget tool execution limit exceeded");
    }
  }

  recordToolExecution(tokens: number): AgentBudgetUsage {
    this.assertToolExecutionAllowed();
    const nextUsage: AgentBudgetUsage = {
      ...this.usage,
      toolExecutions: this.usage.toolExecutions + 1,
      tokens: this.usage.tokens + tokens
    };
    if (nextUsage.tokens > this.budget.tokenLimit) {
      throw new AgentContractError("AgentBudget token limit exceeded");
    }
    this.usage = nextUsage;
    return this.usage;
  }
}
