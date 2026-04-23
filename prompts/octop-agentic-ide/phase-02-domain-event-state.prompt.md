# Phase 2 Prompt: Durable Domain, Event Journal, and State Machines

## Goal

플랫폼의 모든 작업 판단 기준을 durable domain model, append-only event journal, 명시적 state machine으로 구현하십시오.

이 phase는 과거 구조의 임시 connector 메모리에서 상태를 옮기는 작업이 아닙니다. 새 서비스 플랫폼의 authoritative state를 처음부터 설계하고 구현하는 작업입니다.

## Required Domain Model

다음 aggregate와 entity를 구현하십시오.

- `Tenant`
- `User`
- `Membership`
- `Workspace`
- `Repository`
- `WorkspaceRuntime`
- `AppServerConnection`
- `AppServerSchemaVersion`
- `AppServerSession`
- `AppServerThread`
- `AppServerTurn`
- `AppServerItem`
- `AppServerNotificationOffset`
- `AppServerApprovalMirror`
- `AppServerRateLimitMirror`
- `Thread`
- `Run`
- `Agent`
- `AgentTaskContract`
- `AgentWorkItem`
- `AgentLease`
- `AgentBudget`
- `ResourcePool`
- `TenantQuota`
- `UserQuota`
- `WorkspaceQuota`
- `CapacityReservation`
- `RunQueueSlot`
- `CommandResourceClass`
- `OverloadSignal`
- `SupervisorDecision`
- `SupervisorCheckpoint`
- `WorkScope`
- `FileLease`
- `Command`
- `ApprovalRequest`
- `Conflict`
- `Integration`
- `Artifact`
- `Checkpoint`
- `Notification`
- `AuditEvent`

각 model은 id, tenant id, created/updated timestamp, actor, version, lifecycle state를 가져야 합니다. cross-tenant reference는 schema와 repository layer에서 차단하십시오.

## Required Event Journal

- append-only event store를 PostgreSQL 기반으로 구현하십시오.
- aggregate id와 aggregate version으로 optimistic concurrency를 보장하십시오.
- command idempotency key를 지원하십시오.
- event payload는 versioned schema로 검증하십시오.
- event metadata에는 tenant id, user id, request id, causation id, correlation id, source service, timestamp를 포함하십시오.
- snapshot/compaction 정책을 구현하고 문서화하십시오.
- event replay로 read model을 재구성할 수 있어야 합니다.
- PII와 secret이 event payload에 저장되지 않도록 validation을 넣으십시오.

## Required State Machines

Run states:

- `draft`
- `queued`
- `waiting_for_capacity`
- `planning`
- `planned`
- `assigning`
- `preparing_workspace`
- `binding_app_server`
- `running`
- `waiting_for_input`
- `waiting_for_approval`
- `blocked`
- `recovering`
- `verifying`
- `ready_for_review`
- `integrating`
- `completed`
- `failed`
- `cancelled`

Command states:

- `received`
- `deduplicated`
- `authorized`
- `queued`
- `waiting_for_capacity`
- `dispatching`
- `dispatched`
- `acknowledged`
- `rejected`
- `completed`
- `failed`
- `cancelled`

Approval states:

- `requested`
- `visible`
- `approved`
- `rejected`
- `expired`
- `superseded`

Agent states:

- `created`
- `contracted`
- `assigned`
- `working`
- `waiting`
- `blocked`
- `handoff_requested`
- `recovering`
- `verifying`
- `completed`
- `failed`
- `cancelled`

Agent work item states:

- `proposed`
- `accepted`
- `leased`
- `in_progress`
- `needs_input`
- `needs_approval`
- `blocked`
- `handoff_requested`
- `verifying`
- `reported`
- `accepted_by_supervisor`
- `rejected_by_supervisor`
- `cancelled`

Workspace runtime states:

- `provisioning`
- `ready`
- `busy`
- `capacity_blocked`
- `recovering`
- `draining`
- `stopped`
- `failed`

App-server session states:

- `creating`
- `connected`
- `reattaching`
- `recovering`
- `draining`
- `closed`
- `failed`

## Required Implementation

- 허용 transition과 금지 transition을 코드로 정의하십시오.
- invalid transition은 event append 전에 차단하십시오.
- state transition마다 audit event를 남기십시오.
- SupervisorDecision은 반드시 observed state, selected action, policy reason, affected agents, expected verification을 포함해야 합니다.
- AgentTaskContract는 objective, scope, allowed tools, owned files, forbidden files, budget, timeout, dependencies, output schema, verification, escalation rule을 포함해야 합니다.
- AgentBudget은 command count, retry count, wall-clock time, token/cost estimate, tool execution limit을 추적해야 합니다.
- ResourcePool은 global, tenant, user, workspace 단위 capacity와 현재 reservation을 추적해야 합니다.
- CapacityReservation은 resource class, requested capacity, granted capacity, lease expiry, owner command/run id, release reason을 포함해야 합니다.
- RunQueueSlot은 tenant/user/workspace fairness key, priority, enqueue time, starvation age, retry/backoff time을 포함해야 합니다.
- OverloadSignal은 source, severity, observed metric, threshold, recommended action, expiry를 포함해야 합니다.
- heavy command는 CapacityReservation 없이 `dispatching`으로 전환될 수 없습니다.
- AgentLease 만료 시 work item은 자동 completed가 아니라 `blocked` 또는 `recovering` 평가 대상으로 전환되어야 합니다.
- TaskSupervisorAgent와 RoleAgent는 자신의 WorkScope를 넓힐 수 없고 `handoff_requested` 또는 `needs_approval` event만 발행할 수 있어야 합니다.
- recovery marker와 failure classification을 구현하십시오.
- checkpoint artifact 저장 경로와 metadata schema를 정의하십시오.
- projection worker가 event journal을 읽어 run timeline, agent roster, approval inbox, workspace status read model을 생성하게 하십시오.
- projection worker가 supervisor decisions, agent contracts, budgets, leases, blockers, handoffs를 read model로 생성하게 하십시오.
- projection worker가 resource pool, quota, capacity reservation, queue depth, overload signal read model을 생성하게 하십시오.
- migration, seed, replay, projection reset command를 구현하십시오.
- domain invariant 테스트를 작성하십시오.

## Verification

- journal append 원자성 테스트
- optimistic concurrency 충돌 테스트
- command idempotency 테스트
- invalid transition 차단 테스트
- cross-tenant reference 차단 테스트
- AgentTaskContract 없이 agent work 시작 차단 테스트
- RoleAgent가 scope를 자체 확장하지 못하는 테스트
- AgentBudget 초과 시 SupervisorDecision이 필요한 테스트
- CapacityReservation 없는 heavy command dispatch 차단 테스트
- tenant/user/workspace quota 초과 시 waiting_for_capacity 전환 테스트
- reservation release/replay 후 resource accounting 일관성 테스트
- fair queue ordering과 starvation 방지 테스트
- AgentLease 만료 후 자동 완료되지 않고 recovering/blocking 평가로 전환되는 테스트
- process restart 후 event replay로 run state 복원 테스트
- projection worker reset 후 read model 재구성 테스트
- secret/PII payload validation 테스트

## Completion Criteria

- 플랫폼 상태는 event journal과 database projection만으로 복원됩니다.
- run, command, approval, agent, workspace runtime, app-server session의 lifecycle 변경이 모두 event로 설명됩니다.
- SupervisorAgent의 모든 중요한 판단은 SupervisorDecision event로 설명됩니다.
- 하위 agent의 작업은 AgentTaskContract, AgentBudget, AgentLease로 통제됩니다.
- 무거운 작업은 CapacityReservation, quota, fair queue를 통과해야 실행됩니다.
- 다음 phase의 app-server adapter와 workspace runtime이 이 domain contract를 그대로 사용할 수 있습니다.
