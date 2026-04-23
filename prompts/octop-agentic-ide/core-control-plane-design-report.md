# Core Control Plane Design Report

## 결론

마스터 말씀대로 안정성은 서버나 Agent에서 보장할 수 없습니다. 서버와 Agent는 언제든 재시작되고, 연결이 끊기고, 잘못된 이벤트를 받을 수 있습니다. 안정성은 그 아래의 `Core Control Plane Kernel`이 보장해야 합니다.

따라서 새 구조는 다음 순서로 재설계했습니다.

```text
Core Control Plane Kernel
  -> Server Layer
    -> App-Server Adapter
    -> Gateway
    -> Workspace Runtime
    -> Orchestrator
  -> Agent Layer
    -> SupervisorAgent
    -> TaskSupervisorAgent
    -> RoleAgent
  -> Client Layer
    -> Web / Tablet / Mobile
```

app-server는 Core가 아닙니다. OpenAI 공식 문서 기준으로 app-server는 Codex를 제품에 임베드하기 위한 rich-client integration boundary입니다. Core는 app-server를 강하게 통제하는 adapter port를 제공해야 합니다.

## 공식 문서 분석 요약

사용한 공식 출처:

- https://developers.openai.com/codex/app-server
- https://developers.openai.com/codex/open-source
- https://github.com/openai/codex/tree/main/codex-rs/app-server

공식 문서에서 Core 설계에 직접 반영한 사실:

| 공식 사실 | Core 설계 반영 |
| --- | --- |
| app-server는 rich client용 integration boundary입니다. | app-server를 platform source of truth로 두지 않고 adapter로 격리합니다. |
| protocol은 JSON-RPC 2.0 shape이며 wire에서 header가 생략됩니다. | Core protocol envelope validator를 둡니다. |
| 기본 transport는 stdio JSONL입니다. | production 기본 transport는 Core가 관리하는 stdio process로 둡니다. |
| WebSocket은 experimental/unsupported입니다. | remote WebSocket은 default deny이고 local/dev만 제한적으로 허용합니다. |
| WebSocket remote exposure는 auth를 직접 구성해야 합니다. | Core config validator가 unauthenticated remote listener를 차단합니다. |
| initialize/initialized handshake가 필수입니다. | Core connection state machine이 initialize 전 method 호출을 차단합니다. |
| 핵심 primitive는 Thread, Turn, Item입니다. | Core가 AppServerThread/Turn/Item mirror state를 durable하게 유지합니다. |
| app-server는 bounded queue와 overload error를 가질 수 있습니다. | Core retry/backpressure classifier와 scheduler를 둡니다. |
| generate-ts/generate-json-schema 산출물은 Codex version과 일치합니다. | Core schema registry와 compatibility guard를 둡니다. |
| thread/shellCommand는 sandbox policy를 상속하지 않고 full access입니다. | Core policy에서 기본 차단하고 Workspace Runtime 경로만 허용합니다. |
| command/exec와 fs/* 같은 side-effect method도 존재합니다. | generated schema의 모든 method를 allow, deny, route 중 하나로 분류합니다. |
| account/auth/rate-limit events가 존재합니다. | Core credential/budget/audit model과 분리해 server-side에서만 처리합니다. |

## Core Kernel 구성

```text
Core Control Plane Kernel
  Core Command Admission
  Core Event Journal
  Core State Machine Engine
  Core Policy Engine
  Core Capacity Scheduler
  Core Protocol Registry
  Core Agent Control
  Core Workspace Control
  Core Recovery Scheduler
  Core Projection Checkpoints
  Core Audit and Redaction
```

## Core가 소유해야 하는 상태

- Tenant
- User
- Membership
- Workspace
- WorkspaceEditorSession
- WorkspaceCodeServerProcess
- Repository
- Run
- Command
- ApprovalRequest
- SupervisorDecision
- SupervisorCheckpoint
- AgentTaskContract
- AgentWorkItem
- AgentLease
- AgentBudget
- ResourcePool
- TenantQuota
- UserQuota
- WorkspaceQuota
- CapacityReservation
- RunQueueSlot
- CommandResourceClass
- OverloadSignal
- WorkScope
- FileLease
- AppServerConnection
- AppServerSchemaVersion
- AppServerSession
- AppServerThread
- AppServerTurn
- AppServerItem
- AppServerNotificationOffset
- AppServerApprovalMirror
- AppServerRateLimitMirror
- Artifact
- AuditEvent

## Core가 차단해야 하는 것

- app-server credential browser 노출
- remote WebSocket listener without auth
- production WebSocket dependency
- initialize 전 app-server method 호출
- schema compatibility 확인 없는 app-server adapter 시작
- generated schema의 method policy matrix 미분류 상태
- app-server `thread/shellCommand`
- app-server `command/exec*` without Workspace Runtime routing
- app-server `fs/*` without WorkScope/FileLease policy
- app-server config/plugin/marketplace mutation without explicit Core feature flag
- unrestricted `cwd`
- shared `code-server` process
- raw `code-server` container address/password/token browser exposure
- editor session without tenant/user/workspace authorization
- Core policy에서 생성되지 않은 sandbox/profile override
- destructive action without ApprovalRequest
- RoleAgent scope self-expansion
- budget-exhausted tool execution
- lease-expired continuation
- heavy command or sandbox provision without CapacityReservation
- tenant/user/workspace quota exhaustion
- new heavy workload during overload/drain mode
- SupervisorDecision 없는 final completion

## Server Layer 재정의

서버는 Core의 port adapter입니다.

| Server | Core와의 관계 |
| --- | --- |
| Gateway | Core public command/query/read-model port |
| App-Server Adapter | Core app-server protocol port |
| Workspace Runtime | Core execution command port |
| Orchestrator | Core supervisor/agent command port |
| Projection Worker | Core event replay/read-model port |

서버는 판단하지 않습니다. 판단은 Core state machine과 policy engine이 합니다.

샌드박스별로 server layer를 복제하지 않습니다. App-Server Adapter, Orchestrator, Workspace Runtime Tool Gateway, Projection Worker는 platform stack service이고, tenant/workspace/run id로 격리된 작업 단위를 관리합니다. 샌드박스별로 직접 존재하는 것은 sandbox container, `code-server`, filesystem mount, terminal/test/build process, 필요 시 lightweight runner입니다.

Event Store와 Projection은 Core foundation의 authoritative state입니다. sandbox 안에 event store를 두면 sandbox 장애가 source of truth 손상으로 이어지므로 금지합니다. 필요하면 tenant/workspace/run 기준 shard나 partition을 둘 수 있지만, 논리적 소유자는 Core입니다.

## 다중 사용자 고부하 제어

여러 사용자가 무거운 작업을 동시에 실행해도 안정성을 보장하려면 격리만으로는 부족합니다. Core가 capacity admission, fair queue, reservation lease, overload/drain mode를 1급 상태로 가져야 합니다.

이 설계의 목적은 사용자를 제한하거나 자원 상태를 사용자에게 떠넘기는 것이 아닙니다. Core가 내부에서 자원을 분배하고 작업을 순차/병렬로 조율해, 사용자는 작업이 접수되고 안정적으로 완수되는 흐름만 경험해야 합니다.

핵심 판단:

- heavy work는 `CapacityReservation` 없이 dispatch될 수 없습니다.
- quota 부족은 실패가 아니라 `waiting_for_capacity` 또는 queued 상태입니다.
- tenant/user/workspace별 fair queue로 특정 사용자의 독점을 막습니다.
- host overload signal이 있으면 신규 heavy workload와 sandbox provision을 멈추고 recovery, cancel, approval, read-only inspection을 우선합니다.
- capacity state는 event journal로 replay 가능해야 하며, worker process memory count를 source of truth로 쓰면 안 됩니다.
- quota, waiting_for_capacity, backpressure, overload, drain은 admin/operator 관측면에만 노출하고 일반 사용자 UX에는 제품 상태로 매핑합니다.

## Agent Layer 재정의

Agent는 Core를 직접 통제하는 것이 아니라 Core가 허용한 command를 실행합니다.

- SupervisorAgent는 Core의 안정성 제어 루프를 운용합니다.
- TaskSupervisorAgent는 Core가 발급한 AgentTaskContract 안에서 하위 작업을 나눕니다.
- RoleAgent는 AgentTaskContract, AgentLease, AgentBudget, WorkScope 안에서만 작업합니다.
- 모든 handoff, blocker, approval, scope expansion은 Core event로 올라갑니다.

## 구현 순서 변경

기존:

```text
foundation -> domain -> app-server -> runtime -> gateway -> agents/UI
```

변경:

```text
phase 00 Core Control Plane Kernel
  -> phase 01 Service Shell on Core
  -> phase 02 Domain/Event expansion
  -> phase 03 App-Server Adapter
  -> phase 04 Workspace Runtime
  -> phase 05 Gateway/Projection
  -> phase 06+ Clients
  -> phase 10 Durability
```

## Core Gate

다음이 통과되기 전에는 app-server adapter도, Gateway도, Agent도 올리면 안 됩니다.

- generated app-server schema compatibility
- JSON-RPC envelope validation
- initialize handshake enforcement
- WebSocket production deny policy
- app-server shell command deny policy
- command idempotency
- event append atomicity
- state machine transition guard
- tenant isolation
- secret redaction
- AgentTaskContract enforcement
- AgentBudget enforcement
- AgentLease enforcement
- WorkScope/FileLease enforcement
- SupervisorDecision completion gate
- replay recovery

## 최종 설계 판단

이 구조에서는 app-server, 서버, Agent가 모두 Core 위에서만 움직입니다.

- app-server가 강력한 기능을 제공하더라도 Core policy를 통과하지 못하면 실행되지 않습니다.
- 서버가 재시작되어도 Core event journal과 checkpoint로 복구됩니다.
- Agent가 잘못된 작업을 시도해도 contract, lease, budget, scope가 차단합니다.
- UI는 Core projection만 읽고 Core command만 보냅니다.

이제 안정성의 중심은 Agent가 아니라 Core입니다. Agent는 안정적인 Core를 조작하는 controller입니다.
