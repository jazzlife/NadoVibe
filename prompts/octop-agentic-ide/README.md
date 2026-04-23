# OctOP Multi-Agent IDE Platform Prompt Pack

이 폴더는 OpenAI Codex app-server 프로토콜을 제품 안에 통합해, 웹/태블릿/모바일에서 동작하는 멀티에이전트 IDE 서비스 플랫폼을 새로 구현하기 위한 기준 프롬프트를 보관합니다.

이 프롬프트 팩은 기존 데스크탑 서비스, 기존 로컬 bridge, 기존 sandbox-manager를 고치는 작업이 아닙니다. 저장소에 구현 코드가 없으면 greenfield로 플랫폼을 세우고, 구현 코드가 있으면 현재 시점의 파일을 다시 읽은 뒤 새 플랫폼 목표에 맞게 필요한 부분만 유지하거나 교체합니다.

## App-Server 기준

OpenAI 공식 문서 기준으로 Codex app-server는 Codex를 제품 안에 깊게 임베드하는 리치 클라이언트용 인터페이스입니다. 인증, 대화 히스토리, 승인, 스트리밍 agent event 같은 제품 통합 경계를 담당합니다.

- 공식 문서: https://developers.openai.com/codex/app-server
- 공식 open-source 위치: https://github.com/openai/codex/tree/main/codex-rs/app-server
- app-server는 Codex 통합 경계이지 플랫폼 코어가 아닙니다.
- 플랫폼의 tenant, workspace, run, agent, approval, audit, billing, projection 상태는 자체 durable control plane에 저장합니다.
- 자동화 job 또는 CI 전용 실행은 별도 설계 대상이며, 리치 IDE 클라이언트 통합의 기준은 app-server입니다.

공식 문서에서 반드시 반영해야 하는 사실:

- Protocol은 JSON-RPC 2.0 기반이며 wire에서는 `"jsonrpc":"2.0"` header가 생략됩니다.
- 기본 transport는 `stdio` JSONL입니다.
- WebSocket transport는 experimental/unsupported입니다. production remote exposure에 의존하지 마십시오.
- WebSocket remote exposure는 명시적 auth 없이는 위험합니다. remote listener를 열지 않는 것을 기본 정책으로 삼으십시오.
- 모든 connection은 `initialize` request와 `initialized` notification을 완료하기 전 다른 method를 호출할 수 없습니다.
- app-server의 핵심 primitive는 `Thread`, `Turn`, `Item`입니다.
- `thread/start`, `thread/resume`, `thread/fork`, `thread/read`, `thread/list`, `turn/start`, `turn/steer`, `turn/interrupt`를 typed contract로 다루십시오.
- app-server는 bounded queue를 사용하며 overload 시 retryable JSON-RPC error를 반환할 수 있습니다. client는 exponential backoff와 jitter를 사용해야 합니다.
- `codex app-server generate-ts` 또는 `generate-json-schema`로 실행 중인 Codex version과 정확히 맞는 schema artifact를 생성해야 합니다.
- `thread/shellCommand`는 thread sandbox policy를 상속하지 않고 full access로 실행될 수 있으므로 플랫폼 코어에서 기본 차단해야 합니다.
- app-server의 `command/exec*`, `fs/*`, `config/*`, `plugin/*`, `marketplace/*`, `skills/config/write`, `experimentalFeature/*` 같은 side-effect method는 Core method policy matrix에서 명시적으로 allow되지 않으면 제품 경로에서 기본 차단합니다.
- app-server가 명령 실행, 파일 변경, network approval을 요청하면 제품은 이를 platform `ApprovalRequest`와 Workspace Runtime command로 변환하거나 차단해야 합니다. app-server가 Core WorkScope/FileLease/CapacityReservation을 우회해 직접 실행하게 만들지 마십시오.
- app-server account/auth/rate-limit event는 플랫폼 credential, tenant, budget, audit 모델과 분리해 server-side에서만 처리합니다.

## 전역 구현 원칙

- 기존 데스크탑 앱 수정, desktop bridge 확장, 이미 있는 OctOP Studio 보수라는 전제를 사용하지 마십시오.
- 코드를 수정하기 전 반드시 현재 시점의 관련 파일을 다시 읽고 그 내용을 기준으로 구현하십시오.
- 추측으로 API, 상태, 파일 경로를 만들지 말고 구현 전에 현재 코드와 공식 문서를 확인하십시오.
- 임시 stub, mock-only 구현, TODO로 동작을 미루는 코드를 남기지 마십시오.
- 모든 사용자/조직/워크스페이스 경계는 멀티테넌트 보안 모델로 구현하십시오.
- app-server, orchestrator, workspace runtime, gateway, projection, client UI는 명확한 서비스 경계를 가집니다.
- 상태의 기준은 durable event log와 database projection입니다. 프로세스 메모리는 캐시일 뿐입니다.
- UI는 Gateway API와 event stream만 사용하고 내부 runtime 또는 app-server credential에 직접 접근하지 않습니다.
- 모든 phase는 구현, 테스트, 장애 재현, 개선, 최종 보고까지 끝내야 완료입니다.

## 운영 환경 기준

실제 구동 대상은 Ubuntu Server입니다.

- 모든 장기 실행 service는 Docker container로 구동합니다.
- Portainer에서 의존성이 강한 service들을 stack 단위로 묶고, 각 stack은 docker-compose 스크립트로 구동합니다.
- Core와 durable storage는 가장 먼저 올라오는 foundation stack에 배치합니다.
- Gateway, App-Server Adapter, Orchestrator, Projection Worker, Workspace Runtime은 Core gate 통과 후 의존성 있는 stack으로 분리합니다.
- 유저별 sandbox는 별도 Docker image로 빌드하고, 사용자/워크스페이스별 container로 독립 실행합니다.
- sandbox container는 tenant/workspace/run identity와 volume/network/resource limit이 분리되어야 합니다.
- `code-server`는 각 사용자/워크스페이스 sandbox container 내부에서만 독립 실행합니다. 공유 `code-server`, host-level editor server, tenant 간 재사용 editor process는 금지합니다.
- `code-server` 외부 접근은 Gateway가 발급한 짧은 수명의 editor session과 reverse proxy 경로로만 허용합니다. container 내부 port, password/token, filesystem path는 browser API에 노출하지 않습니다.
- 데이터는 로컬 volume에 안전하게 보관하고, event journal, database, object/artifact storage, repository workspace, app-server state, audit log는 명시적 volume 경로를 가져야 합니다.
- NATS, SYSBASE 등 후보 의존 서비스는 필요할 때만 채택하고, 채택 전 실제 오픈소스 여부, 라이선스, 운영 적합성, 대체 가능성을 검증합니다. 모든 의존 서비스는 Core port 뒤에 숨겨 service 교체가 제품 상태 모델을 깨지 않게 합니다.
- Docker/Portainer 구성도 Core를 우회해 service가 직접 상태를 변경할 수 없게 해야 합니다.

## Core-First 설계 결정

서버와 Agent는 코어 위에 올라가는 실행자일 뿐입니다. app-server adapter, Gateway, Workspace Runtime, Orchestrator, UI를 구현하기 전에 `Core Control Plane Kernel`을 먼저 완성해야 합니다.

Core가 먼저 통제해야 하는 것:

- tenant/user/workspace/repository/run identity
- command admission, idempotency, ordering, cancellation
- event journal, state machine, replay, projection checkpoint
- policy, RBAC, approval, destructive action gate
- app-server protocol schema registry and compatibility
- app-server session/thread/turn/item mirror state
- workspace execution policy, WorkScope, FileLease
- workspace sandbox container, `code-server` process, editor session/proxy grant state
- agent contract, lease, budget, heartbeat, handoff
- resource budget, rate limit, backpressure, retry
- capacity admission, fair scheduling, resource reservation, overload shedding
- audit, secret redaction, artifact metadata
- recovery marker, failure classification, supervisor decision

Core gate:

- Core가 command/event/state/policy/recovery를 deterministic하게 검증하지 못하면 어떤 server도 붙이지 마십시오.
- app-server adapter는 Core의 protocol port에 붙는 adapter입니다. app-server가 Core를 우회해 run 상태, shell, approval, workspace 권한을 직접 결정하면 안 됩니다.
- Agent는 Core의 `AgentTaskContract`와 command API를 통해서만 작업합니다.

## Bridge 설계 결정

작업 안정성을 위해 `bridge`는 새 플랫폼의 1급 service 또는 상태 소유자로 만들지 않습니다. 예전 구조의 bridge 책임은 다음 경계로 분해합니다.

- Client ingress: `Gateway API + Realtime Stream`
- Codex integration: `App-Server Adapter`
- Workspace execution: `Workspace Runtime Tool Gateway`
- lifecycle decision: `Orchestrator + Control Plane`
- authoritative state: `Event Store + PostgreSQL Projection`

금지 사항:

- `services/bridge`를 새로 만들지 마십시오.
- app-server, filesystem, git, terminal, UI stream을 하나의 범용 bridge process에 몰아넣지 마십시오.
- connector process memory, websocket session, browser state를 run 상태의 기준으로 삼지 마십시오.
- bridge restart/reconnect를 run 실패 판단과 직접 연결하지 마십시오.

허용 사항:

- `adapter`, `client`, `tool gateway`, `relay` 같은 typed boundary는 사용할 수 있습니다.
- 단, 이 boundary는 durable state를 소유하지 않고 idempotent command, durable event, lease, checkpoint를 통해 재시작 가능해야 합니다.

## Agent Control 안정성 모델

`SupervisorAgent`는 앱 안정성을 보장하는 제어 루프의 소유자입니다. 직접 파일/터미널을 임의 실행하는 작업자가 아니라, durable state를 관측하고 정책에 맞는 결정을 내리며 하위 agent와 runtime을 통제합니다.

Supervisor 제어 루프:

1. Observe: event journal, projections, queues, leases, service health, workspace status, app-server session, test/diff/approval 상태를 읽습니다.
2. Decide: state machine, policy, budget, failure classification을 기준으로 다음 결정을 내립니다.
3. Command: idempotent command를 queue에 넣거나 하위 agent에 `AgentTaskContract`를 배정합니다.
4. Verify: command 결과, artifact, test, diff, approval 상태를 확인합니다.
5. Recover: lease 만료, service restart, conflict, timeout, failed command를 복구 또는 escalation합니다.
6. Checkpoint: 의미 있는 결정과 산출물을 event journal과 artifact에 남깁니다.

하위 agent 제어 원칙:

- 모든 TaskSupervisorAgent와 RoleAgent는 `AgentTaskContract` 없이 작업하지 않습니다.
- contract에는 objective, scope, allowed tools, owned files, forbidden files, budget, timeout, dependencies, output schema, verification, escalation rule이 포함되어야 합니다.
- 하위 agent는 자기 scope 안에서만 계획/수정/검증하고, scope 밖 작업은 escalation해야 합니다.
- agent heartbeat, lease, progress, blocker, handoff request는 durable event로 남깁니다.
- SupervisorAgent만 run completion, final integration, destructive approval, broad recovery를 결정할 수 있습니다.

## 목표 아키텍처

```text
Web / Tablet PWA / Mobile PWA
  -> Gateway API + Realtime Stream
    -> Server Layer: Gateway, App-Server Adapter, Workspace Runtime, Orchestrator
      -> Core Control Plane Kernel
        -> Command Journal + Event Store + State Machines
        -> Policy/RBAC/Approval + Lease/Budget/Backpressure
        -> Schema Registry + App-Server Protocol Mirror
        -> Projection Checkpoints + Audit + Artifacts
          -> PostgreSQL + Queue + Object Storage
          -> Local Docker Volumes on Ubuntu Server
          -> Per-User Sandbox Containers
             -> isolated code-server + filesystem/git/terminal/test runtime
```

## Sandbox별 배치 기준

샌드박스마다 전체 platform service set을 복제하지 않습니다. 샌드박스는 격리된 코드 실행면이고, Core와 server layer는 다수의 tenant/workspace/sandbox를 통제하는 platform stack입니다.

샌드박스별로 존재하는 것:

- isolated sandbox container
- workspace/repository filesystem mount
- `code-server` process
- terminal/test/build command process
- sandbox-private network/resource/volume boundary
- editor session/proxy grant target
- 필요 시 sandbox 내부의 lightweight tool runner

샌드박스별로 직접 존재하지 않는 것:

- `Core Control Plane Kernel`
- `Event Store`
- `PostgreSQL Projection`
- `Projection Worker`
- `Gateway`
- `App-Server Adapter service`
- `Orchestrator service`
- authoritative queue/object/audit store

중요한 예외:

- `App-Server Adapter service`는 platform stack에 존재합니다. 다만 Core 정책에 따라 tenant/user/workspace/run별 app-server session 또는 child process/container를 생성하고 binding할 수 있습니다.
- `Workspace Runtime Tool Gateway`도 platform service입니다. 샌드박스 내부에는 실행 대상 process 또는 lightweight runner가 있을 수 있지만, 권한 판단과 durable state는 Tool Gateway와 Core가 소유합니다.
- Event Store와 Projection은 tenant/workspace/run id로 논리 분리합니다. 규모가 커지면 물리 shard를 둘 수 있지만, sandbox container 내부에 authoritative event store를 두지 않습니다.

## 다중 사용자 고부하 안정성 기준

여러 사용자가 무거운 작업을 동시에 여러 개 실행해도 플랫폼은 안정적으로 작업을 완수해야 합니다. Core는 사용자에게 제어 부담을 넘기지 않고 내부에서 capacity admission, fair scheduling, resource reservation으로 자원을 분배합니다.

Core가 통제하는 자원:

- global capacity: host CPU, memory, disk, pids, network, queue depth
- tenant capacity: 동시 run 수, 동시 sandbox 수, CPU/memory/disk quota, token/cost budget
- user capacity: 동시 run 수, terminal/test/build 동시 실행 수, editor session 수
- workspace capacity: file/git/terminal/test command concurrency, FileLease/WorkScope
- app-server capacity: session/turn concurrency, bounded queue/backpressure
- projection capacity: event lag, rebuild load, read model update budget

내부 원칙:

- 실행 전에 `CapacityReservation`을 발급받지 못하면 run은 `queued` 또는 `waiting_for_capacity`에 머뭅니다.
- resource reservation은 durable event로 기록하고 lease 만료, 취소, 실패, 완료 시 반드시 반환합니다.
- tenant별 fair queue와 priority를 사용해 한 사용자의 무거운 작업이 전체 platform worker를 독점하지 못하게 합니다.
- overload 시 새 작업을 실패 처리하지 않고 내부 scheduling, delayed retry, progressive execution으로 전환합니다.
- host resource가 임계치를 넘으면 Core는 신규 sandbox provision과 heavy command dispatch를 중단하고 recovery/drain 우선순위로 전환합니다.
- 작업이 무겁다는 사실은 terminal command 문자열 추측이 아니라 declared resource class, historical runtime, command policy, observed metrics를 함께 사용해 판단합니다.

사용자 경험 원칙:

- 일반 사용자에게 `quota`, `CapacityReservation`, `waiting_for_capacity`, `backpressure`, `overload`, `queue position` 같은 내부 용어를 노출하지 않습니다.
- 사용자의 명령은 빠르게 접수하고, 가능한 준비 작업과 가벼운 분석을 먼저 진행해 작업이 멈춘 것처럼 보이지 않게 합니다.
- 사용자 화면은 기술적 대기 사유가 아니라 "작업 준비 중", "분석 진행 중", "테스트 준비 중", "검토 필요"처럼 결과 완수 관점의 상태를 보여줍니다.
- 내부 자원 부족으로 실행이 지연되더라도 사용자가 직접 자원을 조작하거나 대기열을 관리하게 만들지 않습니다.
- 운영자와 관리자에게만 quota, saturation, overload, drain 상태를 노출합니다.

## 파일

- `supervisor-run.prompt.md`
  - 새 멀티에이전트 IDE 플랫폼 구현 run을 지휘하는 SupervisorAgent 기준 프롬프트입니다.
- `phase-00-core-control-plane.prompt.md`
  - app-server 공식 문서 분석을 기반으로 서버와 Agent 밑에 깔릴 Core Control Plane Kernel을 구현하는 기준 프롬프트입니다.
- `phase-01-platform-foundation.prompt.md`
  - Core 위에 올라갈 service shell, monorepo, local dev, infra 기준 프롬프트입니다.
- `phase-02-domain-event-state.prompt.md`
  - durable domain model, event journal, state machine, projection 기준 프롬프트입니다.
- `phase-03-app-server-integration.prompt.md`
  - Codex app-server integration plane과 typed adapter 기준 프롬프트입니다.
- `phase-04-workspace-runtime.prompt.md`
  - workspace runtime, sandbox, filesystem/git/terminal tool gateway 기준 프롬프트입니다.
- `phase-05-gateway-projection.prompt.md`
  - public Gateway API, realtime stream, read model projection 기준 프롬프트입니다.
- `phase-06-web-control-room.prompt.md`
  - desktop web Agent Control Room과 IDE control surface 기준 프롬프트입니다.
- `phase-07-tablet-code-workbench.prompt.md`
  - 태블릿 PWA Code Workbench 기준 프롬프트입니다.
- `phase-08-mobile-command-review.prompt.md`
  - 모바일 command, approval, recovery, final review UX 기준 프롬프트입니다.
- `phase-09-operations-update-rollback.prompt.md`
  - 운영, 배포, 업데이트, 롤백, 마이그레이션 기준 프롬프트입니다.
- `phase-10-durability-validation.prompt.md`
  - 장시간 내구성, 장애 주입, 복구 검증 기준 프롬프트입니다.
- `prompt-redesign-report.md`
  - 기존 프롬프트 문제 분석과 재설계 결과 보고서입니다.
- `bridge-stability-design-report.md`
  - 예전 bridge 개념을 제거하고 안정성 중심 service boundary로 분해한 설계 검토 보고서입니다.
- `agent-control-stability-report.md`
  - SupervisorAgent와 하위 Agent들이 안정적으로 작업을 통제할 수 있는지 재검토하고 보강한 설계 보고서입니다.
- `core-control-plane-design-report.md`
  - app-server 공식 문서를 분석해 Core-first 시스템으로 다시 설계한 보고서입니다.
- `deployment-runtime-context-report.md`
  - Ubuntu Server, Docker, Portainer stack, 유저별 sandbox image, 로컬 volume 보존 조건을 반영한 운영 설계 보고서입니다.
- `multi-user-load-stability-report.md`
  - 여러 유저가 무거운 작업을 동시에 실행할 때의 capacity admission, quota, fair queue, overload/drain 설계 보고서입니다.
- `prompt-implementation-readiness-report.md`
  - 공식 app-server 문서 기준 최종 구현 가능성 점검과 Go 판단 보고서입니다.

## 사용 순서

1. `supervisor-run.prompt.md`로 전체 구현 run의 판단 기준을 고정합니다.
2. `phase-00-core-control-plane.prompt.md`로 Core Control Plane Kernel을 먼저 구현하고 검증합니다.
3. Core gate를 통과한 뒤 phase 01부터 phase 10까지 순서대로 실행합니다.
4. 각 phase는 이전 phase의 실제 코드와 테스트 결과를 다시 읽고 시작합니다.
5. phase 사이에서 아키텍처 결정을 바꾸면 core schema, event schema, API contract, UI contract, 운영 문서를 함께 갱신합니다.
6. 최종 결과는 `reports/final-report.md`와 phase별 검증 로그로 남깁니다.

## 구현 진행 원칙

- 프롬프트에 명시한 순서대로 구현합니다.
- 잘못된 계획이나 구현은 중단 사유가 아니라 수정 대상입니다. 코드 재검토, 실패 재현, 원인 수정, 검증 재실행을 거쳐 목적을 완수합니다.
- 구현자는 일반적인 계획 승인, 구현 선택, phase 전환, 수정 방향에 대해 사용자 승인을 기다리지 않습니다.
- 사용자 승인 없이 진행한다는 원칙은 제품 런타임의 Core 안전 게이트와 `ApprovalRequest`를 제거한다는 뜻이 아닙니다. 구현 진행은 자율적으로, 제품 안전 정책은 강하게 유지합니다.
- UI 구현은 필요하면 Pencil을 사용해 UX 품질을 최대화합니다. Pencil에서 얻은 디자인은 실제 frontend code, responsive behavior, Playwright screenshot/interaction 검증까지 연결되어야 완료입니다.
