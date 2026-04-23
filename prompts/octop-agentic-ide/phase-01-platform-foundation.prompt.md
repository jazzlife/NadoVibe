# Phase 1 Prompt: Service Shell on Core Foundation

## Goal

Phase 0의 `Core Control Plane Kernel` gate를 통과한 뒤, 그 코어 위에 올라갈 service shell과 local infrastructure를 구현하십시오.

이 phase의 목표는 서버를 먼저 만드는 것이 아닙니다. Core가 이미 command/state/policy/recovery를 통제한다는 전제 위에서 Gateway, App-Server Adapter, Orchestrator, Workspace Runtime, Projection Worker, Web client가 Core port에만 연결되는 구조를 만드십시오.

구동 대상은 Ubuntu Server이며, service들은 Docker container로 실행하고 Portainer에서 의존성 있는 단위별 stack으로 관리합니다.

## Required Discovery

- 저장소 전체 파일 목록을 읽고 실제 구현 코드가 있는지 확인하십시오.
- 이미 있는 코드가 있다면 현재 파일을 다시 읽고 greenfield 플랫폼 목표와 충돌하는 데스크탑/로컬 전제를 제거하십시오.
- 코드가 없다면 TypeScript 기반 monorepo를 직접 구성하십시오.
- Phase 0 Core gate 결과와 generated app-server schema artifact를 읽으십시오.
- OpenAI Codex app-server 공식 문서와 현재 사용 가능한 app-server 소스/프로토콜을 다시 확인하고 adapter가 Core를 우회하지 않는지 문서화하십시오.
- Ubuntu Server, Docker Engine, Compose plugin, Portainer stack 운영 전제를 문서와 preflight에 반영하십시오.

## Required Architecture

다음 service boundary를 Core port adapter로 명시적으로 만드십시오.

- `apps/web`
  - desktop web Control Room, tablet/mobile PWA의 shared shell 기반
- `apps/gateway`
  - Core public command/query/read-model port adapter
- `services/control-plane`
  - Core Control Plane Kernel runtime host
- `services/app-server-adapter`
  - Core app-server protocol port adapter
- `services/orchestrator`
  - Core supervisor/agent command port adapter
- `services/workspace-runtime`
  - Core execution command port adapter
- `services/projection-worker`
  - Core event replay/read-model port adapter
- `packages/core-kernel`
  - Phase 0에서 구현한 Core Control Plane Kernel
- `packages/domain`
  - Core domain types를 export하는 compatibility package
- `packages/api-contract`
  - Core command/query/read-model schemas와 public API schemas
- `packages/ui`
  - shared IDE UI components
- `infra/local`
  - local docker compose, database, queue, object storage, Core runtime wiring
- `infra/portainer`
  - Ubuntu Server용 stack별 docker-compose 파일
  - stack별 `.env.example`
  - volume/network naming policy
  - service dependency map
- `docs`
  - architecture, local development, security, operating model

## Required Implementation

- package manager, workspace scripts, lint, test, typecheck, build scripts를 구성하십시오.
- local development compose를 구성하십시오.
- Portainer stack용 docker-compose 구성을 작성하십시오.
- stack은 `core-foundation`, `app-server-adapter`, `workspace-runtime`, `gateway-projection`, `clients`, `ops-observability`처럼 의존성 단위로 나누십시오.
- PostgreSQL, queue, object storage, core-control-plane, gateway, web, adapter, orchestrator, workspace runtime health check를 구현하십시오.
- NATS, SYSBASE 등 후보 의존 서비스는 채택 전 실제 오픈소스 여부, 라이선스, 운영 적합성, 대체 가능성을 검증한 뒤 stack dependency로 선언하고, Core port 뒤에 숨기십시오.
- 모든 persistent data는 명시적 local volume에 저장하십시오.
- volume은 database/event journal, object/artifact store, repositories, workspaces, app-server state, logs/audit, backups로 구분하십시오.
- 환경 변수 schema validation을 구현하고 누락 시 명확히 실패하게 하십시오.
- tenant/user/workspace seed flow는 Core command API를 통해서만 구현하십시오.
- auth boundary를 구현하십시오. 개발용 auth도 tenant/user identity와 RBAC claim을 실제로 생성해야 합니다.
- 모든 service에 `/healthz`, `/readyz`, structured logging, request id propagation을 추가하십시오.
- API contract 생성과 타입 공유 흐름을 구성하십시오.
- `docs/architecture.md`에 Core-first service boundary와 app-server adapter 책임을 문서화하십시오.
- `docs/local-development.md`에 부팅, 테스트, 종료 절차를 문서화하십시오.

## Non-Negotiable Rules

- 기존 desktop app 또는 legacy connector를 유지한다는 표현을 코드와 문서에 남기지 마십시오.
- Core를 우회하는 server-to-server mutation API를 만들지 마십시오.
- Gateway, App-Server Adapter, Workspace Runtime, Orchestrator는 모두 Core command/query port를 통과해야 합니다.
- app-server credential, user token, workspace secret을 browser에 노출하지 마십시오.
- health check 성공은 실제 dependency 연결까지 검증해야 합니다.
- Docker volume이 anonymous volume으로 생성되어 중요한 데이터가 위치를 잃는 구성을 금지하십시오.
- Portainer stack 간 dependency와 network는 명시적으로 이름을 부여하십시오.
- “나중에 연결”되는 빈 service를 만들지 마십시오. 최소 기능이라도 Core port를 통과하는 실제 요청/응답과 검증이 있어야 합니다.

## Verification

- dependency install
- lint
- typecheck
- unit test
- API contract validation
- local compose config validation
- Portainer stack compose config validation
- Ubuntu Server Docker/Compose/Portainer preflight
- persistent local volume mount/write/read verification
- local services boot and health check
- Core gate 재실행
- tenant/user/workspace seed request through Core command API
- server가 Core를 우회해 mutation하지 못하는 테스트

## Completion Criteria

- 새 플랫폼 monorepo가 부팅 가능한 상태입니다.
- Ubuntu Server에서 Portainer stack으로 올릴 compose 구성이 준비됩니다.
- Gateway에서 tenant/user/workspace 기본 정보를 Core projection을 통해 조회할 수 있습니다.
- 각 service가 health와 ready 상태를 실제 dependency 기준으로 반환합니다.
- app-server adapter 책임과 Core 연결 방식이 문서화되어 있습니다.
- 모든 server mutation은 Core command API를 통과합니다.
- 모든 durable data path가 local volume 정책에 따라 문서화됩니다.
- 이후 phase가 이 foundation 위에서 domain, app-server, runtime, UI를 확장할 수 있습니다.
