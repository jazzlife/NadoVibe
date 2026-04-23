import type { ActorRef } from "@nadovibe/core-events";

export type PolicyDecisionStatus = "allowed" | "denied";

export interface ApprovalGrant {
  readonly approvalRequestId: string;
  readonly approvedBy: ActorRef;
  readonly approvedAt: string;
}

export interface PolicyRequest {
  readonly tenantId: string;
  readonly actor: ActorRef;
  readonly action: string;
  readonly resourceTenantId: string;
  readonly destructive?: boolean;
  readonly approval?: ApprovalGrant;
}

export interface PolicyDecision {
  readonly status: PolicyDecisionStatus;
  readonly reason: string;
}

export class PolicyDeniedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PolicyDeniedError";
  }
}

export class CorePolicyEngine {
  decide(request: PolicyRequest): PolicyDecision {
    if (request.tenantId !== request.resourceTenantId) {
      return { status: "denied", reason: "cross-tenant resource access is denied" };
    }
    if (request.destructive === true && request.approval === undefined) {
      return { status: "denied", reason: "destructive action requires ApprovalRequest approval" };
    }
    return { status: "allowed", reason: "Core policy allowed" };
  }

  assertAllowed(request: PolicyRequest): void {
    const decision = this.decide(request);
    if (decision.status === "denied") {
      throw new PolicyDeniedError(decision.reason);
    }
  }
}

const SECRET_KEY_PATTERN = /(api[_-]?key|token|password|secret|credential|private[_-]?key|authorization)/i;
const SECRET_VALUE_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/;

export function redactSecrets<T>(value: T): T {
  return redact(value) as T;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(entry);
    }
    return output;
  }
  if (typeof value === "string" && SECRET_VALUE_PATTERN.test(value)) {
    return "[REDACTED]";
  }
  return value;
}
