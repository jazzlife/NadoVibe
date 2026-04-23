# Deployment Runtime Context Report

## 결론

운영 환경 조건을 Core-first 설계에 반영했습니다.

대상 서버는 Ubuntu Server이며, 모든 장기 실행 service는 Docker container로 실행합니다. Portainer에서는 의존성이 강한 service들을 stack 단위로 묶고 docker-compose 스크립트로 구동합니다. 유저별 sandbox는 별도 Docker image로 만들고 사용자/워크스페이스별 독립 container로 실행합니다. `code-server`도 각 sandbox container 내부에서 사용자/워크스페이스별 독립 프로세스로 실행합니다. 데이터는 local Docker volume에 안전하게 보관합니다.

## 운영 기준

- OS: Ubuntu Server
- Runtime: Docker Engine + Docker Compose plugin
- 관리: Portainer stack
- 배포 단위: dependency boundary별 docker-compose stack
- Sandbox: user/workspace별 Docker image + isolated container
- Persistence: local Docker volumes
- Capacity: Core-managed quota, reservation, fair queue, overload/drain mode
- Optional dependency candidates: NATS, SYSBASE 등. 채택 전 오픈소스 여부, 라이선스, 운영 적합성, 대체 가능성을 검증합니다.

## Stack 분리

| Stack | 책임 | 주요 의존성 |
| --- | --- | --- |
| `core-foundation` | Core Control Plane, event journal, policy, state machine | PostgreSQL, queue/event bus, object/artifact store |
| `app-server-adapter` | Codex app-server stdio lifecycle, schema compatibility, Thread/Turn/Item mirror | core-foundation |
| `workspace-runtime` | sandbox image/container lifecycle, per-sandbox `code-server`, filesystem/git/terminal/test | core-foundation, local workspace volumes |
| `gateway-projection` | public API, realtime stream, projection worker | core-foundation |
| `clients` | Web/Tablet/Mobile PWA | gateway-projection |
| `ops-observability` | backup, restore, logs, metrics, diagnostics | all stacks |

## Sandbox와 Platform Service 경계

샌드박스별로 전체 stack을 복제하지 않습니다.

샌드박스별 독립 대상:

- sandbox container
- workspace/repository volume mount
- `code-server` process
- terminal/test/build process
- sandbox-private network/resource quota
- 필요 시 lightweight sandbox runner

platform stack 공용 대상:

- Core Control Plane
- Event Store
- PostgreSQL Projection
- Projection Worker
- Gateway
- App-Server Adapter service
- Orchestrator service
- queue/event bus
- object/artifact/audit store

App-Server Adapter는 공용 service이지만 run/workspace별 app-server session 또는 child process/container를 Core 정책에 따라 생성할 수 있습니다. 이것은 sandbox별 adapter service 복제가 아니라 adapter가 관리하는 격리된 execution/session unit입니다.

Workspace Runtime Tool Gateway도 공용 service입니다. 샌드박스 내부 process는 실행 대상일 뿐이며, 권한 판단, event 기록, recovery 결정은 Core와 Workspace Runtime이 담당합니다.

## 다중 사용자 고부하 운영

여러 유저가 무거운 작업을 동시에 실행하는 상황은 정상 운영 시나리오로 다룹니다. 단, 무제한 병렬 실행은 허용하지 않습니다.

이 영역의 목적은 사용자에게 자원 상태를 인지시키거나 통제하게 만드는 것이 아닙니다. 시스템이 내부적으로 자원을 분배해 사용자가 요청한 작업을 안정적으로 완수하게 만드는 것입니다.

Core가 관리하는 capacity 단위:

- global host quota: CPU, memory, disk, inode, pids, network, queue depth
- tenant quota: active run, active sandbox, heavy command concurrency, token/cost budget
- user quota: active run, editor session, terminal/test/build concurrency
- workspace quota: filesystem/git/terminal/test concurrency와 FileLease
- service quota: app-server session/turn, workspace runtime worker pool, projection lag

운영 규칙:

- sandbox provision과 heavy command dispatch는 `CapacityReservation`이 있어야 시작합니다.
- quota가 부족하면 run/command는 실패가 아니라 `waiting_for_capacity` 또는 queued 상태로 남습니다.
- tenant fair queue를 사용해 특정 tenant/user가 worker pool을 독점하지 못하게 합니다.
- host pressure가 높으면 overload signal을 발행하고 신규 heavy workload를 막습니다.
- drain mode에서는 신규 heavy workload와 sandbox provision을 막고 approval, cancel, recovery, read-only inspection을 우선합니다.
- Portainer stack 설정에는 worker pool size, Docker cgroup limit, log rotation, volume quota, queue retention, projection lag threshold가 포함되어야 합니다.
- quota, overload, drain, worker saturation 정보는 admin/operator 관측면에만 표시하고 일반 사용자 UX에는 노출하지 않습니다.
- 일반 사용자 UX는 작업 접수, 준비, 진행, 검토, 완료 흐름으로만 표현합니다.

## Local Volume 정책

중요 데이터는 anonymous volume을 금지하고 명시적 volume 경로를 가져야 합니다.

- database/event journal
- projection checkpoints
- queue/event bus persistence
- object/artifact storage
- repositories
- workspaces
- `code-server` user-data/extensions/cache
- app-server state
- audit logs
- backups
- sandbox image cache

각 volume은 다음 metadata를 가져야 합니다.

- stack name
- service name
- data class
- backup class
- restore priority
- tenant/workspace 영향 범위
- retention policy

## Sandbox 운영

유저별 sandbox는 독립적으로 구동합니다.

- sandbox image는 version metadata를 가집니다.
- sandbox image에는 검증된 `code-server` version과 healthcheck가 포함됩니다.
- container name과 label에는 tenant id, user id, workspace id, run id를 포함합니다.
- CPU, memory, pids, disk quota를 설정합니다.
- network는 사용자/워크스페이스 경계를 넘지 않게 분리합니다.
- volume mount는 WorkScope와 FileLease 정책에 맞춰 read/write 범위를 제한합니다.
- `code-server`는 해당 sandbox container 내부에서만 실행하며 공유 instance를 두지 않습니다.
- `code-server` port는 public host port로 직접 publish하지 않고 Gateway reverse proxy와 Core editor session을 통해서만 접근합니다.
- `code-server` user-data, extensions, cache, settings는 tenant/user/workspace 경계로 분리된 local volume 또는 명시적 subpath에 저장합니다.
- `code-server` crash/restart는 run 실패가 아니라 workspace recovering/editor session reissue 대상으로 처리합니다.
- container kill/recreate 후에도 local volume 기준으로 workspace state를 복구해야 합니다.

## NATS/SYSBASE 등 의존 서비스 후보

NATS, SYSBASE 등 후보 서비스는 필요할 때만 채택합니다. 이름만으로 오픈소스 서비스라고 단정하지 않고, 구현 전 실제 제품명, 라이선스, 운영 적합성, 대체 가능성을 확인해야 합니다.

원칙:

- Core port 뒤에 숨깁니다.
- 제품 domain model이 특정 infrastructure product에 직접 종속되지 않게 합니다.
- license/OSS 확인 결과를 운영 문서에 남깁니다.
- persistence, backup, restore, upgrade 정책을 stack 문서에 포함합니다.
- 장애 시 Core replay와 projection rebuild로 복구 가능해야 합니다.

## Preflight

Ubuntu Server preflight는 다음을 확인해야 합니다.

- Docker Engine 동작
- Compose plugin 동작
- Portainer stack deploy 가능
- required ports 충돌 없음
- required networks 생성 가능
- required local volumes mount 가능
- volume write/read 가능
- disk space 충분
- inode, pids, memory, CPU, network capacity 충분
- Docker cgroup limit과 log rotation 설정 정상
- Core quota profile과 worker pool size 설정 정상
- file permission 정상
- backup path write 가능
- restore marker 읽기 가능
- app-server generated schema artifact 존재
- sandbox image의 `code-server` version metadata와 healthcheck 정상

## 구현 반영

반영된 파일:

- `README.md`
- `phase-00-core-control-plane.prompt.md`
- `phase-01-platform-foundation.prompt.md`
- `phase-02-domain-event-state.prompt.md`
- `phase-04-workspace-runtime.prompt.md`
- `phase-05-gateway-projection.prompt.md`
- `phase-06-web-control-room.prompt.md`
- `phase-07-tablet-code-workbench.prompt.md`
- `phase-09-operations-update-rollback.prompt.md`
- `phase-10-durability-validation.prompt.md`
- `supervisor-run.prompt.md`
- `core-control-plane-design-report.md`
- `multi-user-load-stability-report.md`

## 최종 판단

이제 프롬프트는 실제 운영 대상인 Ubuntu Server + Docker + Portainer stack + local volume persistence + user sandbox container + per-sandbox `code-server` 구조를 기준으로 구현을 시작할 수 있습니다.

Core가 먼저 persistent volume, dependency, policy, recovery, editor session, capacity admission을 통제하고, 그 위에 server stack과 sandbox runtime이 올라가는 구조입니다.
