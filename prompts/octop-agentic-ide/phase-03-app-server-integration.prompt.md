# Phase 3 Prompt: Codex App-Server Integration Plane

## Goal

OpenAI Codex app-server를 Core Control Plane Kernel이 강하게 통제하는 rich-client agent integration adapter로 연결하십시오.

이 phase는 app-server를 플랫폼 코어로 삼는 작업이 아닙니다. Codex app-server와 Core Control Plane 사이의 typed adapter, schema compatibility, connection lifecycle, thread/turn/item mirror, approval relay, streamed event ingestion을 구현하는 작업입니다.

## Required Discovery

- 현재 공식 문서에서 Codex app-server의 목적과 권장 사용 범위를 확인하십시오.
- 현재 사용할 app-server 소스 또는 배포 artifact의 protocol surface를 읽으십시오.
- protocol method, event shape, auth requirement, reconnect behavior를 문서화하십시오.
- 문서와 실제 소스가 다르면 실제 integration test에서 확인 가능한 계약을 기준으로 삼고 차이를 기록하십시오.
- `codex app-server generate-ts` 또는 `generate-json-schema`를 실행해 현재 Codex version과 일치하는 schema artifact를 생성하십시오.
- 공식 문서의 transport, initialization, backpressure, thread/turn/item, shell command, account/rate-limit 내용을 Core policy에 반영하십시오.

## Official Protocol Rules

- JSON-RPC 2.0 message shape를 사용하되 wire에서 `"jsonrpc":"2.0"` header는 생략됩니다.
- production 기본 transport는 Core가 lifecycle을 관리하는 `stdio` JSONL입니다.
- WebSocket transport는 experimental/unsupported이므로 production remote dependency로 사용하지 마십시오.
- remote WebSocket listener는 Core config에서 default deny이며 명시적 auth와 feature flag 없이는 시작할 수 없습니다.
- 모든 connection은 `initialize` request와 `initialized` notification을 완료해야 합니다.
- Core는 `Thread`, `Turn`, `Item`을 durable mirror로 보관합니다.
- app-server overload error는 retryable로 분류하고 exponential backoff+jitter를 적용합니다.
- `thread/shellCommand`는 sandbox policy를 상속하지 않고 full access로 실행될 수 있으므로 default deny입니다.
- `command/exec*`, `fs/*`, config/plugin/marketplace mutation methods는 generated schema에 존재할 수 있으므로 Core method policy matrix에 반드시 분류하십시오.
- app-server `initialize.params.clientInfo.name`과 thread `serviceName`은 제품 integration 식별자로 고정하고, enterprise 배포 시 OpenAI compliance logs 식별 요구사항을 확인하십시오.

## Required Service Boundary

`services/app-server-adapter`는 다음 책임만 가집니다.

- app-server process/container lifecycle 관리
- tenant/user/workspace/run과 app-server session binding
- app-server auth/session credential을 server-side에 보관
- Core policy를 통과한 thread/start, thread/resume, thread/fork, thread/read, thread/list adapter
- Core policy를 통과한 turn/start, turn/steer, turn/interrupt adapter
- Thread/Turn/Item durable mirror event 발행
- streamed agent event ingestion
- approval request/response relay
- app-server disconnect/reconnect/recovering event 발행
- protocol version detection과 compatibility guard
- app-server account/rate-limit event server-side 처리와 Core budget mirror 반영
- app-server method policy matrix enforcement

배치 기준:

- `services/app-server-adapter` 자체는 sandbox별로 복제하지 않는 platform service입니다.
- adapter는 Core 정책에 따라 tenant/user/workspace/run별 app-server session 또는 child process/container를 생성할 수 있습니다.
- app-server session/process는 Core의 `AppServerSession`, `AppServerThread`, `AppServerTurn`, `AppServerItem` mirror에 binding되어야 하며, sandbox container memory나 adapter memory가 source of truth가 되면 안 됩니다.
- app-server가 workspace 작업을 요구할 때도 filesystem/git/terminal 실행은 Workspace Runtime Tool Gateway와 sandbox policy를 통해서만 수행합니다.
- app-server가 command execution approval, file change approval, network approval을 요청하면 adapter는 이를 platform `ApprovalRequest`로 변환하고, 승인 후에도 Workspace Runtime policy를 통과한 경로로만 실행되게 하십시오.

`services/app-server-adapter`는 다음 책임을 가지면 안 됩니다.

- run 최종 성공/실패 판단
- tenant policy 결정
- workspace filesystem/git/terminal 직접 실행
- UI projection 직접 수정
- browser에 app-server credential 전달
- Core policy 없이 sandbox/profile/cwd override 전달
- Core policy 없이 `thread/shellCommand` 호출
- Core policy 없이 `command/exec*` 또는 `fs/*`를 호출
- Core feature flag 없이 app-server config/plugin/marketplace mutation method 호출

## Required Implementation

- typed app-server client를 구현하십시오.
- generated schema artifact를 Core protocol registry에 등록하십시오.
- generated schema의 모든 method를 Core method policy matrix에 매핑하고, unknown method는 startup failure로 차단하십시오.
- connection state machine을 구현하고 initialize 전 method 호출을 차단하십시오.
- initialize request에는 제품 client metadata를 넣고, thread/start에는 serviceName을 넣어 integration 식별성을 유지하십시오.
- app-server session aggregate와 event journal을 연결하십시오.
- `AppServerSession` lifecycle transition을 구현하십시오.
- app-server event를 platform event schema로 normalize하십시오.
- Thread/Turn/Item mirror aggregate를 구현하십시오.
- thread history read API를 Gateway 내부용 service contract로 노출하십시오.
- reconnect/reattach flow를 구현하십시오.
- approval request가 app-server에서 발생하면 platform `ApprovalRequest`로 변환하십시오.
- 승인/거절 결과를 app-server로 되돌려보내는 command path를 구현하십시오.
- app-server event stream backpressure와 retry policy를 구현하십시오.
- overload JSON-RPC error를 retryable로 분류하고 Core retry scheduler에 연결하십시오.
- protocol version mismatch는 명확한 platform error로 차단하십시오.
- WebSocket remote config validator와 stdio lifecycle manager를 구현하십시오.
- `thread/shellCommand` 호출 시도는 Core policy violation으로 기록하고 차단하십시오.
- `command/exec*`, `fs/*`, config/plugin/marketplace mutation method 호출 시도는 Core policy violation 또는 Workspace Runtime routed command로 명확히 처리하십시오.
- integration contract test harness를 구현하십시오. 테스트 harness는 제품 경로를 대체하지 않고 protocol 검증에만 사용하십시오.
- adapter telemetry: session count, event lag, reconnect count, approval roundtrip latency를 기록하십시오.

## Required Events

- `app_server.session_requested`
- `app_server.session_created`
- `app_server.session_connected`
- `app_server.thread_bound`
- `app_server.turn_started`
- `app_server.item_started`
- `app_server.item_completed`
- `app_server.event_received`
- `app_server.approval_requested`
- `app_server.approval_delivered`
- `app_server.reconnect_started`
- `app_server.reattached`
- `app_server.recovering`
- `app_server.closed`
- `app_server.failed`

## Verification

- app-server session create/bind test
- initialize 전 method 호출 차단 테스트
- generated schema compatibility 테스트
- unsupported WebSocket production config 차단 테스트
- remote WebSocket without auth 차단 테스트
- thread list/read/reattach contract test
- turn start/steer/interrupt contract test
- Thread/Turn/Item mirror replay 테스트
- streamed event ingestion order test
- overload error retry/backoff 테스트
- approval request -> platform approval -> app-server response test
- reconnect 중 run이 failed로 확정되지 않는 테스트
- protocol version mismatch 차단 테스트
- `thread/shellCommand` default deny 테스트
- `command/exec*` direct execution default deny 또는 Workspace Runtime routing 테스트
- `fs/*` direct filesystem access default deny 또는 WorkScope/FileLease routing 테스트
- config/plugin/marketplace mutation method default deny 테스트
- browser에 app-server credential이 노출되지 않는 API 테스트

## Completion Criteria

- app-server adapter가 Core event journal과 연결됩니다.
- app-server event가 durable timeline으로 들어옵니다.
- Thread/Turn/Item 상태가 Core mirror로 복원됩니다.
- approval과 reconnect가 platform lifecycle에 반영됩니다.
- Orchestrator와 Gateway가 app-server 내부 구현을 몰라도 Core-governed typed adapter contract를 사용할 수 있습니다.
- app-server는 Core policy와 schema registry를 우회할 수 없습니다.
- generated schema의 모든 app-server method가 allow, deny, route 중 하나로 명시 분류됩니다.
