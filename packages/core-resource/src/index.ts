export type ResourceClass = "light" | "interactive" | "test" | "build" | "long_running" | "high_mem";
export type AdmissionStatus = "granted" | "queued" | "waiting_for_capacity" | "denied";
export type OverloadSeverity = "none" | "warning" | "critical";

export interface CapacityQuota {
  readonly maxConcurrent: number;
  readonly maxByClass: Partial<Record<ResourceClass, number>>;
}

export interface CapacityReservation {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly commandId: string;
  readonly resourceClass: ResourceClass;
  readonly grantedUnits: number;
  readonly expiresAt: number;
  readonly releasedAt?: number;
  readonly releaseReason?: string;
}

export interface OverloadSignal {
  readonly source: "cpu" | "memory" | "disk" | "pids" | "queue" | "projection" | "app_server";
  readonly severity: OverloadSeverity;
  readonly observedMetric: number;
  readonly threshold: number;
  readonly recommendedAction: "admit" | "slow_down" | "drain";
  readonly expiresAt: number;
}

export interface ReservationRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly commandId: string;
  readonly resourceClass: ResourceClass;
  readonly now: number;
  readonly ttlMs: number;
}

export interface AdmissionResult {
  readonly status: AdmissionStatus;
  readonly reason: string;
  readonly reservation?: CapacityReservation;
}

export interface RunQueueSlot {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly priority: number;
  readonly enqueueTime: number;
  readonly retryAfter?: number;
}

export class ResourcePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcePolicyError";
  }
}

export const HEAVY_RESOURCE_CLASSES = new Set<ResourceClass>(["test", "build", "long_running", "high_mem"]);

export function isHeavyResourceClass(resourceClass: ResourceClass): boolean {
  return HEAVY_RESOURCE_CLASSES.has(resourceClass);
}

export class CapacityAdmissionController {
  private globalQuota: CapacityQuota = { maxConcurrent: 4, maxByClass: { light: 8, interactive: 4, test: 2, build: 1, long_running: 1, high_mem: 1 } };
  private readonly tenantQuotas = new Map<string, CapacityQuota>();
  private readonly userQuotas = new Map<string, CapacityQuota>();
  private readonly workspaceQuotas = new Map<string, CapacityQuota>();
  private readonly reservations = new Map<string, CapacityReservation>();
  private readonly overloadSignals: OverloadSignal[] = [];
  private nextReservation = 1;

  setGlobalQuota(quota: CapacityQuota): void {
    this.globalQuota = quota;
  }

  setTenantQuota(tenantId: string, quota: CapacityQuota): void {
    this.tenantQuotas.set(tenantId, quota);
  }

  setUserQuota(userId: string, quota: CapacityQuota): void {
    this.userQuotas.set(userId, quota);
  }

  setWorkspaceQuota(workspaceId: string, quota: CapacityQuota): void {
    this.workspaceQuotas.set(workspaceId, quota);
  }

  addOverloadSignal(signal: OverloadSignal): void {
    this.overloadSignals.push(signal);
  }

  reserve(request: ReservationRequest): AdmissionResult {
    this.expireReservations(request.now);
    const activeCriticalOverload = this.overloadSignals.some(
      (signal) => signal.expiresAt > request.now && signal.severity === "critical" && signal.recommendedAction === "drain"
    );
    if (activeCriticalOverload && isHeavyResourceClass(request.resourceClass)) {
      return { status: "waiting_for_capacity", reason: "host overload signal blocks heavy dispatch" };
    }

    const quotaChecks = [
      this.checkQuota("global", "global", this.globalQuota, request.resourceClass),
      this.checkQuota("tenant", request.tenantId, this.tenantQuotas.get(request.tenantId), request.resourceClass),
      this.checkQuota("user", request.userId, this.userQuotas.get(request.userId), request.resourceClass),
      this.checkQuota("workspace", request.workspaceId, this.workspaceQuotas.get(request.workspaceId), request.resourceClass)
    ].filter((result): result is AdmissionResult => result !== undefined);

    const blocked = quotaChecks.find((result) => result.status !== "granted");
    if (blocked) {
      return blocked;
    }

    const reservation: CapacityReservation = {
      id: `res_${this.nextReservation++}`,
      tenantId: request.tenantId,
      userId: request.userId,
      workspaceId: request.workspaceId,
      runId: request.runId,
      commandId: request.commandId,
      resourceClass: request.resourceClass,
      grantedUnits: 1,
      expiresAt: request.now + request.ttlMs
    };
    this.reservations.set(reservation.id, reservation);
    return { status: "granted", reason: "capacity reservation granted", reservation };
  }

  release(reservationId: string, now: number, reason: string): CapacityReservation {
    const existing = this.reservations.get(reservationId);
    if (!existing) {
      throw new ResourcePolicyError(`Unknown reservation ${reservationId}`);
    }
    const released: CapacityReservation = { ...existing, releasedAt: now, releaseReason: reason };
    this.reservations.set(reservationId, released);
    return released;
  }

  expireReservations(now: number): readonly CapacityReservation[] {
    const expired: CapacityReservation[] = [];
    for (const reservation of this.reservations.values()) {
      if (!reservation.releasedAt && reservation.expiresAt <= now) {
        const released = { ...reservation, releasedAt: now, releaseReason: "expired" };
        this.reservations.set(reservation.id, released);
        expired.push(released);
      }
    }
    return expired;
  }

  assertCanDispatch(resourceClass: ResourceClass, reservationId: string | undefined, now: number): void {
    if (!isHeavyResourceClass(resourceClass)) {
      return;
    }
    if (!reservationId) {
      throw new ResourcePolicyError("Heavy command dispatch requires CapacityReservation");
    }
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.releasedAt || reservation.expiresAt <= now || reservation.resourceClass !== resourceClass) {
      throw new ResourcePolicyError("CapacityReservation is not active for this heavy command");
    }
  }

  activeReservations(): readonly CapacityReservation[] {
    return [...this.reservations.values()].filter((reservation) => reservation.releasedAt === undefined);
  }

  private checkQuota(scope: string, scopeId: string, quota: CapacityQuota | undefined, resourceClass: ResourceClass): AdmissionResult | undefined {
    if (!quota) {
      return undefined;
    }
    const active = this.activeReservations().filter((reservation) => {
      if (scope === "global") return true;
      if (scope === "tenant") return reservation.tenantId === scopeId;
      if (scope === "user") return reservation.userId === scopeId;
      return reservation.workspaceId === scopeId;
    });
    const activeByClass = active.filter((reservation) => reservation.resourceClass === resourceClass);
    const maxByClass = quota.maxByClass[resourceClass] ?? quota.maxConcurrent;
    if (active.length >= quota.maxConcurrent || activeByClass.length >= maxByClass) {
      return { status: "waiting_for_capacity", reason: `${scope} capacity is reserved by other work` };
    }
    return { status: "granted", reason: `${scope} capacity available` };
  }
}

export class TenantFairQueue {
  private readonly slotsByTenant = new Map<string, RunQueueSlot[]>();
  private tenantCursor = 0;

  enqueue(slot: RunQueueSlot): void {
    const slots = this.slotsByTenant.get(slot.tenantId) ?? [];
    slots.push(slot);
    slots.sort((left, right) => right.priority - left.priority || left.enqueueTime - right.enqueueTime);
    this.slotsByTenant.set(slot.tenantId, slots);
  }

  dequeue(now: number): RunQueueSlot | undefined {
    const tenants = [...this.slotsByTenant.keys()].filter((tenantId) => {
      const slot = this.slotsByTenant.get(tenantId)?.[0];
      return slot !== undefined && (slot.retryAfter === undefined || slot.retryAfter <= now);
    });
    if (tenants.length === 0) {
      return undefined;
    }
    const tenant = tenants[this.tenantCursor % tenants.length];
    if (tenant === undefined) {
      return undefined;
    }
    this.tenantCursor += 1;
    const slots = this.slotsByTenant.get(tenant);
    const slot = slots?.shift();
    if (slots && slots.length === 0) {
      this.slotsByTenant.delete(tenant);
    }
    return slot;
  }
}
