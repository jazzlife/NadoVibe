import type { IdentitySeedRecord, PlatformReadModels, RunRecord, RunState, ServiceHealth } from "@nadovibe/domain";

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
}

export interface CreateRunResponse {
  readonly run: RunRecord;
  readonly userStatus?: UserRunStatus;
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
  return {
    runId: requireString(record, "runId"),
    workspaceId: requireString(record, "workspaceId"),
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
