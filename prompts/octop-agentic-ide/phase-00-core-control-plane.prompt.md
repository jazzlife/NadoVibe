# Phase 0 Prompt: Core Control Plane Kernel

## Goal

서버, app-server adapter, workspace runtime, UI, Agent를 구현하기 전에 모든 작업 안정성을 보장하는 `Core Control Plane Kernel`을 먼저 구현하십시오.

이 phase는 문서 정리나 추상 설계가 아닙니다. command admission, event journal, state machine, policy, approval, lease, budget, protocol schema, recovery를 실제 코드로 구현하고, 이 코어를 완전히 검증한 뒤에만 상위 server를 올릴 수 있게 하는 gate입니다.

## Official App-Server Facts To Encode

OpenAI 공식 문서와 공식 open-source 위치를 확인하고 다음 사실을 코드/문서/테스트에 반영하십시오.

- app-server는 Codex rich client integration boundary입니다.
- protocol은 JSON-RPC 2.0 message shape를 사용하며 wire에서 `"jsonrpc":"2.0"` header가 생략됩니다.
- 기본 transport는 `stdio` JSONL입니다.
- WebSocket transport는 experimental/unsupported입니다. production remote exposure에 의존하지 마십시오.
- WebSocket remote listener는 명시적 auth 없이는 위험합니다.
- connection은 반드시 `initialize` request 후 `initialized` notification을 완료해야 다른 method를 호출할 수 있습니다.
- app-server 핵심 primitive는 `Thread`, `Turn`, `Item`입니다.
- thread APIs는 create/list/read/resume/fork/archive/metadata/status를 다룹니다.
- turn APIs는 start/steer/interrupt와 turn/item notifications를 다룹니다.
- app-server는 bounded queue를 사용하고 overload 시 retryable JSON-RPC error를 반환할 수 있습니다.
- `codex app-server generate-ts` 또는 `generate-json-schema` 산출물은 실행 중인 Codex version과 정확히 일치해야 합니다.
- `thread/shellCommand`는 thread sandbox policy를 상속하지 않고 full access로 실행될 수 있으므로 Core policy에서 기본 차단하십시오.
- app-server `command/exec*`는 server sandbox에서 command를 실행하고, `fs/*`는 app-server filesystem API로 절대 경로를 다룰 수 있으므로 제품 경로에서는 Core policy matrix와 Workspace Runtime을 통과해야 합니다.
- app-server `config/*`, `plugin/*`, `marketplace/*`, `skills/config/write`, `experimentalFeature/*`는 product state와 execution surface를 바꿀 수 있으므로 explicit allowlist 없이 차단하십시오.
- app-server account/auth/rate-limit events는 tenant credential, budget, audit과 분리해 server-side에서만 처리하십시오.

## Core Principle

Core는 제품의 유일한 판단면입니다.

- app-server는 Core protocol port에 연결되는 adapter입니다.
- Gateway는 Core public command/read port에 연결되는 API layer입니다.
- Workspace Runtime은 Core execution command port에 연결되는 tool gateway입니다.
- Orchestrator와 Agent는 Core agent command port에 연결되는 controller입니다.
- 어떤 server도 Core를 우회해 run, approval, workspace, shell, completion, recovery를 결정할 수 없습니다.

## Runtime Environment Assumptions

- Core는 Ubuntu Server 위 Docker container로 구동됩니다.
- Core foundation stack은 Portainer에서 docker-compose stack으로 관리됩니다.
- Core는 PostgreSQL/event journal, queue/event bus, object/artifact store, audit log를 로컬 Docker volume에 명시적으로 보존합니다.
- NATS, SYSBASE 등 후보 의존 서비스는 채택 전 실제 오픈소스 여부, 라이선스, 운영 적합성, 대체 가능성을 검증하고 Core port 뒤에서만 사용합니다. Core domain model이 특정 infrastructure product에 직접 종속되면 안 됩니다.
- Core startup은 volume mount, file permission, disk space, fsync/durability, backup path, restore marker를 preflight로 검증해야 합니다.
- Core가 사용하는 모든 persistent volume은 stack 이름, service 이름, tenant/workspace 영향 범위, backup class를 문서화해야 합니다.

## Required Core Modules

- `packages/core-kernel`
  - command admission, idempotency, ordering, cancellation
  - state machine engine
  - policy engine
  - capacity admission and fair scheduler
  - durable resource reservation
  - failure classification
  - deterministic decision rules
- `packages/core-events`
  - versioned event schemas
  - append-only journal contract
  - replay and snapshot contract
  - metadata: tenant id, actor, request id, causation id, correlation id, source service
- `packages/core-protocol`
  - app-server generated schema registry
  - JSON-RPC request/response/notification envelope validators
  - protocol version compatibility guard
  - method allow/deny policy
  - app-server method policy matrix by method family
  - overload/backpressure/retry classifier
- `packages/core-security`
  - RBAC, tenant isolation, secret redaction
  - approval policy
  - destructive action gate
  - app-server credential containment
- `packages/core-agent`
  - AgentTaskContract
  - AgentLease
  - AgentBudget
  - SupervisorDecision
  - SupervisorCheckpoint
  - handoff/blocker/escalation contract
- `packages/core-resource`
  - global, tenant, user, workspace capacity policy
  - resource class and command cost model
  - fair queue and priority scheduling
  - capacity reservation lease
  - overload detection and shedding policy
- `packages/core-workspace`
  - WorkScope
  - FileLease
  - WorkspaceCodeServerProcess
  - WorkspaceEditorSession
  - workspace command policy
  - editor session and proxy grant policy
  - artifact metadata
  - shell command allow/deny policy
- `services/core-control-plane`
  - core command API
  - core query API
  - event journal repository
  - projection checkpoint repository
  - recovery scheduler
- `infra/portainer/core-stack`
  - Ubuntu Server용 docker-compose stack
  - local volume mount policy
  - NATS/SYSBASE 등 optional dependency 후보 검증과 wiring
  - preflight and restore scripts

## Required State Mirrors

Core must maintain its own durable mirror of app-server state. Do not use app-server memory as the product source of truth.

- `AppServerConnection`
- `AppServerSchemaVersion`
- `AppServerSession`
- `AppServerThread`
- `AppServerTurn`
- `AppServerItem`
- `AppServerNotificationOffset`
- `AppServerApprovalMirror`
- `AppServerRateLimitMirror`

Core must maintain its own durable state for workspace sandbox and editor access. Do not use container runtime memory, Gateway proxy state, or browser session state as the product source of truth.

- `SandboxContainer`
- `WorkspaceVolume`
- `WorkspaceCodeServerProcess`
- `WorkspaceEditorSession`
- `WorkspaceEditorProxyGrant`

Core must maintain durable capacity state. Do not use in-memory worker counts as the source of truth for concurrent heavy work.

- `ResourcePool`
- `TenantQuota`
- `UserQuota`
- `WorkspaceQuota`
- `CapacityReservation`
- `RunQueueSlot`
- `CommandResourceClass`
- `OverloadSignal`

## Required Policy Gates

The following commands must pass Core policy before reaching app-server or workspace runtime.

- `initializeConnection`
- `startThread`
- `resumeThread`
- `forkThread`
- `startTurn`
- `steerTurn`
- `interruptTurn`
- `compactThread`
- `rollbackThread`
- `archiveThread`
- `approveAction`
- `rejectAction`
- `runWorkspaceCommand`
- `reserveCapacity`
- `releaseCapacity`
- `dispatchQueuedWork`
- `applyPatch`
- `writeFile`
- `issueEditorSession`
- `revokeEditorSession`
- `restartCodeServer`
- `cancelAgentWork`
- `extendAgentLease`

Default deny:

- remote WebSocket listener without explicit auth
- app-server `thread/shellCommand`
- app-server `command/exec*` without Workspace Runtime routing
- app-server `fs/*` without WorkScope/FileLease policy
- app-server config/plugin/marketplace mutation methods without explicit Core feature flag
- app-server experimental API without explicit Core feature flag
- raw app-server credential to browser
- shared `code-server` process
- raw `code-server` container address/password/token to browser
- editor session without tenant/user/workspace authorization
- dispatch without `CapacityReservation`
- tenant/user/workspace quota exhaustion
- heavy command execution when host overload signal is active
- user-provided unrestricted `cwd`
- turn sandbox/profile override not derived from Core policy
- destructive action without ApprovalRequest
- RoleAgent scope expansion
- budget-exhausted agent tool execution
- lease-expired agent work continuation

## Required Implementation

- schema generation command wrapper를 구현하십시오.
- generated app-server schema artifact를 versioned registry에 저장하십시오.
- JSON-RPC envelope validator를 구현하십시오.
- method allow/deny registry와 method family policy matrix를 구현하십시오.
- app-server methods를 stable read/control, approval relay, workspace side effect, configuration mutation, experimental mutation으로 분류하십시오.
- workspace side effect method는 Core WorkScope/FileLease/CapacityReservation을 통과한 Workspace Runtime 경로로만 라우팅하거나 차단하십시오.
- command idempotency store를 구현하십시오.
- append-only event journal repository를 구현하십시오.
- state machine engine과 transition guard를 구현하십시오.
- Core policy engine과 decision log를 구현하십시오.
- capacity admission controller를 구현하십시오.
- global/tenant/user/workspace quota와 fair queue scheduler를 구현하십시오.
- CapacityReservation lease, renewal, release, expiry recovery를 구현하십시오.
- command resource class를 정의하고 light, interactive, test, build, long_running, high_mem 같은 class별 concurrency policy를 구현하십시오.
- overload signal collector를 구현해 CPU, memory, disk, pids, queue depth, projection lag, app-server overload를 Core policy에 반영하십시오.
- SupervisorDecision, AgentTaskContract, AgentLease, AgentBudget을 구현하십시오.
- WorkScope, FileLease, workspace command policy를 구현하십시오.
- WorkspaceCodeServerProcess, WorkspaceEditorSession, WorkspaceEditorProxyGrant state machine을 구현하십시오.
- editor session 발급/만료/폐기/재발급 policy gate를 구현하십시오.
- app-server notification ingestion offset과 replay marker를 구현하십시오.
- overload error classifier와 retry schedule을 구현하십시오.
- recovery scheduler를 구현하십시오.
- secret redaction validator를 구현하십시오.
- Ubuntu Server Docker/volume preflight를 구현하십시오.
- Portainer stack용 docker-compose 파일과 `.env.example`을 구현하십시오.
- local volume backup/restore marker와 integrity check를 구현하십시오.
- Core gate test suite를 구현하십시오.

## Verification

- generated schema가 현재 Codex app-server version과 일치하는 테스트
- initialize 전 method 호출 차단 테스트
- JSON-RPC request/response/notification validation 테스트
- unsupported WebSocket production config 차단 테스트
- unauthenticated remote WebSocket config 차단 테스트
- `thread/shellCommand` 기본 차단 테스트
- app-server `command/exec*`가 Workspace Runtime policy 없이 실행되지 않는 테스트
- app-server `fs/*`가 WorkScope/FileLease 없이 실행되지 않는 테스트
- app-server config/plugin/marketplace mutation method가 explicit Core feature flag 없이 차단되는 테스트
- app-server overload error가 retryable로 분류되는 테스트
- quota exhaustion 시 command가 failed가 아니라 queued/waiting_for_capacity로 전환되는 테스트
- CapacityReservation 없이 heavy command dispatch가 차단되는 테스트
- tenant fair queue가 특정 tenant의 worker 독점을 차단하는 테스트
- host overload signal 발생 시 신규 sandbox와 heavy command dispatch가 중단되는 테스트
- reservation lease 만료/취소/실패/완료 시 capacity가 반환되는 테스트
- command idempotency 테스트
- event append atomicity 테스트
- invalid transition 차단 테스트
- tenant isolation 테스트
- secret redaction 테스트
- AgentTaskContract 없는 work 시작 차단 테스트
- AgentBudget 초과 tool execution 차단 테스트
- AgentLease 만료 후 continuation 차단 테스트
- WorkScope 밖 file write 차단 테스트
- tenant/user/workspace가 다른 `code-server` editor session 접근 차단 테스트
- shared `code-server` process 차단 테스트
- raw `code-server` container address/password/token redaction 테스트
- SupervisorDecision 없는 final completion 차단 테스트
- replay 후 Core state 복원 테스트
- Docker volume mount/permission/disk preflight 테스트
- local volume backup marker와 restore marker 테스트
- NATS/SYSBASE 등 optional dependency 후보의 license/OSS/operational fit validation 테스트
- optional dependency disabled/enabled config validation 테스트

## Core Gate

다음 조건을 모두 통과하기 전에는 phase 01 이상의 server, adapter, runtime, UI 구현으로 넘어가지 마십시오.

- Core command/event/state/policy test가 통과합니다.
- Core capacity admission/fair scheduling test가 통과합니다.
- app-server generated schema compatibility가 검증됩니다.
- default deny policy가 테스트로 고정됩니다.
- app-server method policy matrix가 generated schema의 모든 method family를 allow/deny/route로 분류합니다.
- recovery scheduler가 replay 기반으로 상태를 복구합니다.
- SupervisorDecision 없이 run completion이 불가능합니다.
- AgentTaskContract 없이 agent work가 불가능합니다.
- Core가 editor session/proxy grant를 발급하지 않으면 `code-server` 접근이 불가능합니다.
- app-server credential과 secret은 event/UI response에 저장되지 않습니다.
- Core persistent volumes are mounted, writable, and restorable on Ubuntu Server.
- Portainer core stack compose config validates successfully.

## Completion Criteria

- Core Control Plane Kernel이 독립적으로 테스트 가능합니다.
- app-server 없이도 command/state/policy/recovery invariant를 검증할 수 있습니다.
- app-server를 붙일 때는 Core protocol registry와 policy gate를 반드시 통과해야 합니다.
- 서버와 Agent가 Core를 우회할 수 없는 구조가 코드와 테스트로 증명됩니다.
- Ubuntu Server Docker/Portainer 환경에서 Core foundation stack을 올릴 수 있는 compose와 preflight가 준비됩니다.
