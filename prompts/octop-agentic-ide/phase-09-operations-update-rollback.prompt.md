# Phase 9 Prompt: Operations, Updates, Rollback, and Migration

## Goal

새 멀티에이전트 IDE 플랫폼을 운영 가능한 서비스로 만들고, app-server adapter, orchestrator, workspace runtime, gateway, web client의 배포/업데이트/롤백/마이그레이션 경로를 구현하십시오.

이 phase는 기존 desktop runtime 자동 업데이트가 아닙니다. 서버형 제품 플랫폼의 운영면을 만드는 작업입니다.

운영 대상은 Ubuntu Server이며, 모든 service는 Docker container로 실행하고 Portainer stack과 docker-compose로 배포합니다.

## Required Operational Model

- environment separation: local, staging, production
- image build and versioning
- sandbox image and embedded `code-server` versioning
- Portainer stack layout and compose versioning
- local Docker volume backup/restore policy
- database migration policy
- event schema migration policy
- app-server version compatibility policy
- tenant/workspace별 rollout lock
- active run drain
- capacity plan and quota profile
- overload/drain mode
- canary rollout
- health verification
- rollback
- failed update quarantine
- backup and restore
- audit log
- incident diagnostics

## Required Implementation

- service image build pipeline을 구성하십시오.
- Portainer stack별 docker-compose 파일을 production/staging/local profile로 구성하십시오.
- stack dependency order를 문서화하고 validate command를 구현하십시오.
- production/staging/local profile별 global/tenant/user/workspace quota default를 문서화하고 compose/env validation에 포함하십시오.
- Docker host capacity preflight는 CPU core, memory, disk, inode, pids, network, volume throughput, log rotation 설정을 확인해야 합니다.
- overload/drain mode command를 구현해 신규 heavy workload를 막고 recovery, approval, read-only UI, running task completion을 우선하십시오.
- version endpoint와 build metadata를 모든 service에 추가하십시오.
- migration runner를 구현하십시오.
- backward-compatible event schema migration 절차를 문서화하고 테스트하십시오.
- app-server adapter는 app-server protocol version과 platform compatibility를 검사하십시오.
- active run 중 app-server adapter 또는 orchestrator update는 drain 정책을 통과해야 합니다.
- workspace runtime update는 workspace별 lock을 사용하십시오.
- sandbox image update는 포함된 `code-server` version, extension allowlist, user-data/cache migration compatibility를 검증하십시오.
- active editor session이 있는 workspace runtime update는 workspace별 drain 또는 session 재발급 계획을 통과해야 합니다.
- failed rollout은 quarantine 상태로 기록하고 이전 stable version으로 되돌리십시오.
- canary tenant rollout command를 구현하십시오.
- backup/restore command를 구현하십시오.
- local volume snapshot/backup/restore 절차를 구현하십시오.
- NATS, SYSBASE 등 후보 dependency의 실제 오픈소스 여부, 라이선스, 운영 적합성, persistence, upgrade, backup 정책을 문서화하십시오.
- operational dashboard 또는 admin API에서 service version, migration version, projection lag, queue lag를 볼 수 있게 하십시오.
- operational dashboard 또는 admin API에서 quota usage, reservation count, worker pool saturation, overload signal, top tenants by resource usage를 볼 수 있게 하십시오.

## Required Policies

- active run이 `running`, `waiting_for_approval`, `integrating`이면 app-server adapter update는 기본 차단입니다.
- event journal migration은 down migration보다 forward recovery를 우선합니다.
- local volume backup 없이 destructive migration을 실행하지 마십시오.
- rollback은 database/event schema compatibility check를 통과해야 합니다.
- workspace runtime update 실패는 run 실패가 아니라 runtime recovering event로 처리합니다.
- `code-server` update/restart 실패는 run 실패가 아니라 editor session recovering/revoked 상태로 처리하고 workspace state를 보존해야 합니다.
- orchestrator update는 leases와 command journal을 보존해야 합니다.
- overload/drain mode에서는 신규 heavy run과 sandbox provision을 차단하지만 approval, cancel, read-only inspection, recovery command는 허용합니다.

## Verification

- migration apply/replay test
- incompatible app-server protocol version 차단 테스트
- active run 중 update drain 차단 테스트
- production quota profile validation 테스트
- overload/drain mode에서 신규 heavy run 차단과 기존 recovery 허용 테스트
- top tenant resource usage와 worker saturation metric 표시 테스트
- canary tenant만 새 version으로 라우팅되는 테스트
- Portainer stack dependency order validation 테스트
- sandbox image의 `code-server` version metadata와 healthcheck 테스트
- active editor session 중 workspace runtime update drain/reissue 테스트
- local volume backup/restore dry-run 테스트
- failed update quarantine 테스트
- rollback 후 service health와 projection consistency 테스트
- backup restore 후 tenant/workspace/run read model 복원 테스트

## Completion Criteria

- 플랫폼 service들이 versioned artifact로 배포 가능합니다.
- Ubuntu Server Portainer stack으로 재현 가능한 배포가 가능합니다.
- 업데이트 실패는 격리되고 이전 stable 경로로 복구됩니다.
- app-server version과 platform event schema compatibility가 검증됩니다.
- 운영자가 active run과 tenant 영향을 확인하며 rollout할 수 있습니다.
- 운영자가 capacity, quota, overload 상태를 보고 heavy workload를 drain/control할 수 있습니다.
- `code-server`도 sandbox image 일부로 version, rollout, rollback, recovery가 통제됩니다.
