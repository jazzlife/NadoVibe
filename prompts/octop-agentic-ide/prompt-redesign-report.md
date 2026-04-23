# Prompt Redesign Report

## 분석 범위

다음 수정 전 프롬프트 파일을 모두 직접 읽고 분석했습니다.

- `README.md`
- `supervisor-run.prompt.md`
- `phase-01-user-sandbox-core.prompt.md`
- `phase-02-command-journal-state-machine.prompt.md`
- `phase-03-supervisor-runtime.prompt.md`
- `phase-04-bridge-connector.prompt.md`
- `phase-05-gateway-projection.prompt.md`
- `phase-06-web-agent-control-room.prompt.md`
- `phase-07-tablet-code-workbench.prompt.md`
- `phase-08-mobile-command-review.prompt.md`
- `phase-09-auto-update-rollback.prompt.md`
- `phase-10-durability-validation.prompt.md`

수정 후 산출물은 다음 파일명으로 정리했습니다.

- `README.md`
- `supervisor-run.prompt.md`
- `phase-00-core-control-plane.prompt.md`
- `phase-01-platform-foundation.prompt.md`
- `phase-02-domain-event-state.prompt.md`
- `phase-03-app-server-integration.prompt.md`
- `phase-04-workspace-runtime.prompt.md`
- `phase-05-gateway-projection.prompt.md`
- `phase-06-web-control-room.prompt.md`
- `phase-07-tablet-code-workbench.prompt.md`
- `phase-08-mobile-command-review.prompt.md`
- `phase-09-operations-update-rollback.prompt.md`
- `phase-10-durability-validation.prompt.md`
- `prompt-redesign-report.md`
- `bridge-stability-design-report.md`
- `agent-control-stability-report.md`
- `core-control-plane-design-report.md`
- `deployment-runtime-context-report.md`

## 핵심 결론

기존 프롬프트들은 “이미 OctOP Studio와 sandbox-manager, bridge, app-server container가 있다”는 전제를 깔고 있었습니다. 이 때문에 새 서비스 플랫폼을 구현해야 하는 목표와 맞지 않았습니다.

수정 후 프롬프트들은 OpenAI Codex app-server를 제품 통합 경계로 삼아, 멀티테넌트 control plane, app-server adapter, workspace runtime, orchestrator, Gateway API, projection worker, web/tablet/mobile PWA를 처음부터 구현하도록 재설계했습니다.

추가 재검토 후 최종 구조는 더 강한 Core-first 구조로 변경했습니다. app-server, Gateway, Workspace Runtime, Orchestrator, Agent는 Core Control Plane Kernel 위에 올라가는 adapter/controller이며, Core가 command admission, event journal, state machine, policy, approval, lease, budget, recovery를 먼저 통제합니다.

운영 환경 조건도 추가 반영했습니다. 실제 구동 대상은 Ubuntu Server이며, 장기 실행 service는 Docker container로 실행하고 Portainer stack과 docker-compose로 관리합니다. 유저별 sandbox는 별도 Docker image와 독립 container로 운영하며, durable data는 명시적 local volume에 보존합니다.

## App-Server 해석

OpenAI 공식 문서 기준으로 Codex app-server는 Codex를 제품 안에 깊게 임베드하기 위한 인터페이스이며, 리치 클라이언트에서 인증, 대화 히스토리, 승인, streamed agent event를 다루는 통합 경계입니다.

- 공식 문서: https://developers.openai.com/codex/app-server
- 공식 open-source 위치: https://github.com/openai/codex/tree/main/codex-rs/app-server
- 따라서 app-server는 제품 전체의 database나 business logic이 아닙니다.
- tenant, workspace, run, agent, approval, audit, projection 상태는 플랫폼 control plane의 durable state로 관리해야 합니다.
- browser는 app-server에 직접 붙지 않고 Gateway와 platform realtime stream을 통해서만 상태를 다룹니다.

Core 설계에 추가 반영한 공식 문서 사실:

- app-server protocol은 JSON-RPC 2.0 message shape를 사용합니다.
- 기본 transport는 `stdio` JSONL입니다.
- WebSocket transport는 experimental/unsupported입니다.
- remote WebSocket listener는 명시적 auth 없이는 위험합니다.
- `initialize`와 `initialized` handshake가 필요합니다.
- app-server primitive는 `Thread`, `Turn`, `Item`입니다.
- generated schema는 실행 중인 Codex version과 일치해야 합니다.
- bounded queue overload는 retry/backoff 대상입니다.
- `thread/shellCommand`는 sandbox policy를 상속하지 않고 full access로 실행될 수 있어 Core에서 기본 차단해야 합니다.
- `command/exec*`, `fs/*`, config/plugin/marketplace mutation method도 제품 실행면을 우회할 수 있으므로 generated schema 기반 method policy matrix로 allow/deny/route를 분류해야 합니다.

## 기존 프롬프트별 문제와 재설계

| 기존 파일 | 기존 문제 | 재설계 결과 |
| --- | --- | --- |
| `README.md` | `scripts/sandbox-manager.mjs`와 `final-report-template.md`를 전제로 했지만 저장소에 해당 구현/파일이 없었습니다. 전체 설명도 OctOP Studio 작업 시작용 prompt pack에 머물렀습니다. | greenfield 서비스 플랫폼 prompt pack으로 재정의하고 app-server의 역할, 목표 아키텍처, phase 순서, 전역 구현 원칙을 명시했습니다. |
| `supervisor-run.prompt.md` | “one OctOP user sandbox”의 agent manager로 정의되어 새 제품 전체 구현을 지휘하기에 좁았습니다. | `PlatformBuildSupervisor`로 재정의하고 control plane, adapter, runtime, orchestrator, client를 끝까지 구현/검증하는 기준을 추가했습니다. |
| 신규 `phase-00-core-control-plane.prompt.md` | 기존 phase들은 서버/adapter부터 세우는 흐름이라 Core가 완전히 통제하기 전 서버가 먼저 커질 수 있었습니다. | app-server 공식 문서 분석을 기반으로 command, event, policy, schema, approval, lease, budget, recovery를 먼저 구현하는 Core gate를 추가했습니다. |
| `phase-01-user-sandbox-core.prompt.md` | 유저별 Docker sandbox와 `sandbox-manager` compose 보강에 집중해 기존 로컬 실행 도구를 고치는 형태였습니다. | `phase-01-platform-foundation.prompt.md`로 이름과 내용을 바꾸고 Core gate 통과 후 server shell, local infra, auth, tenant seed, health contract를 Core port 위에 세우는 phase로 변경했습니다. |
| `phase-02-command-journal-state-machine.prompt.md` | bridge memory를 durable state로 옮긴다는 문장 때문에 기존 bridge 전제가 남아 있었습니다. domain model 범위도 부족했습니다. | `phase-02-domain-event-state.prompt.md`로 이름과 내용을 바꾸고 tenant/user/workspace/repository/run/agent/approval/conflict/artifact/audit까지 포함하는 durable domain, event journal, state machine phase로 확장했습니다. |
| `phase-03-supervisor-runtime.prompt.md` | Supervisor runtime부터 구현하게 되어 app-server integration boundary가 뒤로 밀렸고, 새 플랫폼에서 가장 중요한 외부 통합 계약이 불명확했습니다. | `phase-03-app-server-integration.prompt.md`로 이름과 내용을 바꾸고 typed adapter, session/thread/approval/event/reconnect contract를 먼저 안정화하도록 했습니다. |
| `phase-04-bridge-connector.prompt.md` | 기존 bridge를 transport connector로 재정렬한다는 내용이라 “bridge 수정” 전제가 강했습니다. | `phase-04-workspace-runtime.prompt.md`로 이름과 내용을 바꾸고 새 Workspace Runtime과 filesystem/git/terminal tool gateway phase로 재설계했습니다. |
| `phase-05-gateway-projection.prompt.md` | 필요한 API 목록은 있었지만 public Gateway가 내부 runtime/app-server를 숨기는 제품 경계라는 설명이 약했습니다. | API contract, realtime stream, projection read model, tenant isolation, credential 비노출 요구를 강화했습니다. |
| `phase-06-web-agent-control-room.prompt.md` | dashboard feature list 수준이어서 실제 IDE control surface의 정보구조와 검증 기준이 부족했습니다. | `phase-06-web-control-room.prompt.md`로 이름과 내용을 바꾸고 web Agent Control Room의 레이아웃, 상태 표현, diff/test/approval/recovery 조작, Playwright 검증을 구체화했습니다. |
| `phase-07-tablet-code-workbench.prompt.md` | 태블릿 요구는 있었지만 Gateway, WorkScope, offline/reconnect 안전성 연결이 약했습니다. | tablet-first Code Workbench로 재설계하고 file API, hunk approval, selection-to-agent, PWA, reconnect 정책을 명확히 했습니다. |
| `phase-08-mobile-command-review.prompt.md` | 모바일 기능 목록은 있었지만 notification routing, next action, recovery decision의 제품 흐름이 약했습니다. | 모바일 command/review control surface로 재설계하고 push, inbox, quick command, destructive confirmation, final review를 구체화했습니다. |
| `phase-09-auto-update-rollback.prompt.md` | bridge/runtime 업데이트 중심으로 기존 desktop-like runtime 유지 전제가 남아 있었습니다. | `phase-09-operations-update-rollback.prompt.md`로 이름과 내용을 바꾸고 서버형 플랫폼 운영 phase로 변경해 image versioning, migration, canary, drain, rollback, backup/restore, app-server compatibility를 포함했습니다. |
| `phase-10-durability-validation.prompt.md` | 장시간 검증 항목은 있었지만 새 플랫폼의 service별 장애 주입, metric, report 기준이 부족했습니다. | durability/failure injection/end-to-end validation phase로 확장해 3시간 run, restart/reconnect, projection rebuild, UI 복원을 수치로 검증하게 했습니다. |

## 새 플랫폼 설계 요약

```text
Client Layer
  Web Control Room
  Tablet Code Workbench PWA
  Mobile Command/Review PWA

Gateway Layer
  Public API
  Realtime stream
  Auth/RBAC
  Rate limit

Control Plane
  Tenant/User/Workspace/Repository
  Run/Agent/Approval/Conflict
  Policy/Audit/Notification

Integration Plane
  Codex App-Server Adapter
  Session/Thread/Event/Approval/Reattach

Execution Plane
  Workspace Runtime
  Filesystem/Git/Terminal/Test/Artifacts

Orchestration Plane
  SupervisorAgent
  TaskSupervisorAgent
  RoleAgent
  Queues/Leases/Recovery/Integration

Durability Plane
  Event Journal
  Projection Workers
  Object Storage
  Metrics/Logs
```

## Bridge 안정성 설계 변경

추가 검토 결과, bridge를 “가볍게 유지하는 connector”로 남기는 것보다 새 플랫폼의 1급 개념에서 제거하는 편이 장시간 작업 안정성에 더 유리합니다.

결정:

- `services/bridge`는 만들지 않습니다.
- 예전 bridge 책임은 `Gateway`, `App-Server Adapter`, `Workspace Runtime Tool Gateway`, `Orchestrator`, `Event Store/Projection`으로 분해합니다.
- connector, adapter, relay는 허용하지만 durable state를 소유하지 않습니다.
- 어떤 process가 재시작되어도 command idempotency, event journal, lease, checkpoint, projection replay로 복구되어야 합니다.

책임 분해:

| 예전 bridge 책임 | 새 책임 경계 |
| --- | --- |
| browser와 runtime 사이 중계 | `Gateway API + Realtime Stream` |
| app-server thread/reconnect 중계 | `App-Server Adapter` |
| filesystem/git/terminal 실행 | `Workspace Runtime Tool Gateway` |
| run 상태 판단 | `Orchestrator + Control Plane` |
| 임시 in-memory 상태 | `Event Store + PostgreSQL Projection` |
| health와 실패 판단 결합 | service health는 telemetry, run 판단은 state machine |

이 변경으로 bridge가 단일 장애점이 되거나, in-memory 상태 손실이 run 실패로 오판되거나, app-server reconnect와 workspace runtime recovery가 서로 묶이는 위험을 줄였습니다.

## Agent Control 안정성 설계 변경

추가 검토 결과, SupervisorAgent가 앱 안정성을 보장하려면 단순 상위 agent가 아니라 명시적인 제어 루프의 소유자여야 합니다.

결정:

- SupervisorAgent는 observe, decide, command, verify, recover, checkpoint 루프를 소유합니다.
- 중요한 판단은 `SupervisorDecision` event로 기록합니다.
- TaskSupervisorAgent와 RoleAgent는 `AgentTaskContract` 없이 작업할 수 없습니다.
- 하위 agent는 `AgentBudget`, `AgentLease`, `WorkScope`, `FileLease` 안에서만 동작합니다.
- scope 확장, budget 연장, lease revoke, agent cancel, final integration은 SupervisorAgent-only decision입니다.
- Web Control Room은 agent 상태 관측뿐 아니라 pause, resume, cancel, reassign, extend lease, revoke lease, accept report, reject report를 제공해야 합니다.

이 변경으로 하위 agent가 자기 판단으로 scope를 넓히거나, 무한 실행되거나, lease 만료 후 계속 작업하거나, final completed를 오판하는 위험을 줄였습니다.

## 해결된 위험

- 기존 desktop/sandbox-manager를 수정하는 잘못된 전제를 제거했습니다.
- app-server를 business logic 저장소처럼 오해할 가능성을 줄였습니다.
- browser가 app-server credential이나 runtime 내부 API에 직접 접근하지 못하게 경계를 세웠습니다.
- bridge memory 같은 비영속 상태가 authoritative state가 되는 문제를 차단했습니다.
- web/tablet/mobile이 같은 Gateway contract와 projection을 사용하도록 통일했습니다.
- 운영, migration, rollback, 장시간 내구성 검증을 별도 phase로 명확히 만들었습니다.

## 남은 실행 과제

- phase 01 실행 시 TypeScript monorepo 원칙 안에서 package manager와 service runner를 코드로 확정해야 합니다.
- app-server protocol surface는 구현 시점의 공식 문서와 실제 app-server 소스를 다시 읽어 typed adapter에 반영해야 합니다.
- UI phase에서는 실제 디자인 시스템과 visual regression 기준을 코드로 고정해야 합니다.
- 운영 phase에서는 배포 대상 환경의 container registry, secret store, domain, TLS, observability backend를 연결해야 합니다.
