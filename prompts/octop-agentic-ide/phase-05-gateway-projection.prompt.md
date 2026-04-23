# Phase 5 Prompt: Gateway API, Realtime Stream, and Projection

## Goal

웹/태블릿/모바일 클라이언트가 멀티에이전트 IDE 플랫폼을 안전하게 조회하고 조작할 수 있는 public Gateway API, realtime stream, read model projection을 구현하십시오.

Gateway는 app-server, orchestrator, workspace runtime의 내부 API를 browser에 직접 노출하지 않는 제품 경계입니다.

## Required Gateway Capabilities

- authentication and session API
- tenant/workspace/repository API
- app-server session visibility API
- run CRUD and command enqueue API
- agent roster API
- agent task contract API
- agent lease/budget API
- supervisor decision API
- run timeline API
- approval/conflict/integration/recovery queue API
- filesystem tree/read/write request API
- workspace editor session and `code-server` proxy API
- git status/diff/patch approval API
- terminal/test command API
- artifact/diff/test result API
- notification subscription API
- admin health/diagnostics API

## Required Projection Read Models

- tenant workspace list
- repository list and sync status
- run list
- run detail
- run lifecycle timeline
- agent roster
- supervisor decision log
- agent task contracts
- agent lease and budget status
- admin-only resource quota and capacity reservation status
- admin-only queue depth and overload signal status
- agent blockers and handoff requests
- command queue
- approval inbox
- conflict queue
- integration queue
- recovery queue
- workspace file tree summary
- workspace editor session status
- git status summary
- diff summary
- test result summary
- notification inbox
- service health summary

## Required Implementation

- API schema를 `packages/api-contract`에 정의하고 server/client 타입을 생성하십시오.
- 모든 endpoint에 tenant isolation, RBAC, rate limit, request id를 적용하십시오.
- Gateway rate limit은 단순 request rate뿐 아니라 command cost class, tenant quota, user quota, active run count를 Core admission 결과와 함께 내부 판단해야 합니다.
- command enqueue는 idempotency key를 요구하십시오.
- heavy command enqueue는 즉시 실행을 보장하지 않지만, 일반 사용자 API에는 `waiting_for_capacity`, quota, backpressure, overload reason을 직접 반환하지 마십시오.
- 일반 사용자용 projection은 내부 `waiting_for_capacity`를 `accepted`, `preparing`, `in_progress`, `needs_review` 같은 product 상태로 매핑하십시오.
- 사용자 화면이 멈춘 것처럼 보이지 않도록 가능한 분석, 파일 스캔, 계획 정리, 승인 준비 같은 lightweight progress event를 먼저 노출하십시오.
- quota remaining, reservation state, queue position, overload reason read model은 admin/operator API에서만 제공하십시오.
- read endpoint는 projection table을 사용하고 domain aggregate를 직접 긁지 마십시오.
- realtime stream은 durable event offset을 지원해 재접속 후 누락 이벤트를 재전송할 수 있어야 합니다.
- client-facing realtime stream은 SSE 또는 WebSocket 중 하나를 선택하고 선택 이유를 문서화하십시오. 이는 app-server experimental WebSocket transport와 별개의 Gateway stream입니다.
- projection worker는 event journal offset checkpoint를 저장하십시오.
- projection schema migration과 rebuild command를 구현하십시오.
- Gateway response에서 secret, app-server credential, internal container path를 제거하십시오.
- Gateway는 `code-server` raw container host/port/password/token을 노출하지 말고, Core가 허용한 tenant/user/workspace에만 짧은 수명의 editor session URL을 발급하십시오.
- `code-server` reverse proxy는 Gateway 인증/RBAC/rate limit/session expiry를 통과해야 하며, tenant 간 editor session 재사용을 차단하십시오.
- editor session read model은 `ready`, `starting`, `recovering`, `expired`, `revoked` 상태와 마지막 healthcheck 시각을 제공하십시오.
- Gateway는 SupervisorAgent-only command와 RoleAgent command를 RBAC와 policy로 구분하십시오.
- agent control API는 pause, resume, cancel, reassign, extend lease, revoke lease, request handoff, accept report, reject report를 지원하십시오.
- OpenAPI 또는 equivalent contract 문서를 생성하십시오.

## Required API Groups

- `/api/auth/*`
- `/api/tenants/*`
- `/api/workspaces/*`
- `/api/repositories/*`
- `/api/editor-sessions/*`
- `/api/runs/*`
- `/api/agents/*`
- `/api/agent-contracts/*`
- `/api/admin/capacity/*`
- `/api/supervisor-decisions/*`
- `/api/approvals/*`
- `/api/conflicts/*`
- `/api/integrations/*`
- `/api/artifacts/*`
- `/api/notifications/*`
- `/api/stream`
- `/api/health/*`

## Verification

- tenant A가 tenant B run/read model을 조회할 수 없는 테스트
- command enqueue idempotency 테스트
- quota 초과 command가 내부적으로 failed가 아니라 waiting_for_capacity로 기록되는 테스트
- 일반 사용자 API가 quota, waiting_for_capacity, backpressure, overload, queue position을 노출하지 않는 테스트
- tenant별 rate/cost limit과 queue position이 admin projection에만 노출되는 테스트
- overload signal 중 heavy command enqueue가 일반 사용자에게는 accepted/preparing 계열 상태로 응답하고 admin에는 backpressure 원인이 보이는 테스트
- API contract validation 테스트
- event journal -> projection rebuild 테스트
- realtime stream reconnect offset 테스트
- approval command가 durable event로 기록되고 projection에 반영되는 테스트
- SupervisorAgent-only command를 일반 RoleAgent 권한으로 호출할 수 없는 테스트
- agent contract/lease/budget 상태가 projection으로 복원되는 테스트
- agent cancel/reassign/extend lease command가 event journal에 남는 테스트
- app-server credential이 Gateway response에 없는 테스트
- tenant A가 tenant B `code-server` editor session을 열 수 없는 테스트
- `code-server` raw container address/password/token이 Gateway response에 없는 테스트
- editor session expiry/revoke 후 reverse proxy 접근이 차단되는 테스트

## Completion Criteria

- 모든 클라이언트는 Gateway API와 realtime stream만으로 제품을 사용할 수 있습니다.
- UI 상태는 projection read model에서 복원됩니다.
- 사용자는 내부 capacity를 알 필요 없이 작업이 접수되었고 안정적으로 진행되고 있음을 제품 상태로 이해할 수 있습니다.
- 내부 service credential과 execution detail은 public API로 새지 않습니다.
- `code-server` 접근도 Gateway session/proxy 경계 안에서만 동작합니다.
