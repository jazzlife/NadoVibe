# Phase 10 Prompt: Durability, Recovery, and End-to-End Validation

## Goal

새 멀티에이전트 IDE 플랫폼이 장시간 작업, 연결 끊김, service restart, app-server reconnect, workspace runtime 장애를 견디며 실제 작업을 완료할 수 있음을 검증하십시오.

이 phase는 단순 smoke test가 아닙니다. 플랫폼의 durable state, event replay, projection rebuild, reconnect UX, approval safety, final verifier gate를 수치와 로그로 증명하는 작업입니다.

## Required Validation Scenarios

- 3시간 synthetic multi-agent run
- multi-tenant heavy workload saturation run
- quota exhaustion and fair scheduling
- host overload and drain mode
- Ubuntu Server Docker/Portainer stack restart
- local volume backup/restore recovery
- Core Control Plane replay/recovery
- app-server generated schema compatibility drift
- initialize handshake violation
- app-server adapter restart
- Codex app-server reconnect/reattach
- app-server overload and retry/backpressure
- unsupported WebSocket production config
- orchestrator restart
- workspace runtime restart
- per-user sandbox `code-server` process kill/restart
- Gateway `code-server` reverse proxy reconnect/session expiry
- user sandbox container kill/recreate
- user sandbox image rollout/rollback
- projection worker restart/rebuild
- Gateway restart
- PWA reload
- PWA offline/online
- queue disconnect/reconnect
- database connection interruption
- multi-agent file conflict
- agent lease timeout and reassign
- agent budget exhaustion and supervisor decision
- RoleAgent scope violation and escalation
- TaskSupervisorAgent handoff recovery
- approval timeout and recovery
- terminal command timeout/cancel
- app-server `thread/shellCommand` policy violation
- app-server `command/exec*` and `fs/*` direct execution policy violation
- app-server config/plugin/marketplace mutation policy violation
- final verifier gate

## Required Instrumentation

- event journal append latency
- projection lag
- Core command admission latency
- Core policy decision latency
- app-server protocol validation latency
- realtime stream reconnect gap
- app-server event ingestion lag
- command queue latency
- capacity admission latency
- queue wait time by tenant/user/workspace
- reservation lease acquire/release latency
- worker pool saturation by resource class
- host CPU/memory/disk/pids pressure
- approval roundtrip latency
- workspace command runtime
- `code-server` startup and recovery time
- editor session issue/revoke latency
- failed/recovered transition count
- supervisor decision latency
- agent lease timeout recovery time
- agent budget exhaustion count
- handoff resolution time
- run completion time
- data loss count

## Required Implementation

- synthetic run generator를 구현하십시오.
- multi-tenant heavy workload generator를 구현하십시오. 여러 tenant/user/workspace가 build/test/long-running terminal/app-server turn을 동시에 요청해야 합니다.
- failure injection scripts를 구현하십시오.
- durability test suite를 자동화하십시오.
- Core gate suite를 phase 10 시작 시 재실행하십시오.
- Ubuntu Server에서 Portainer stack 기준으로 durability suite를 실행하십시오.
- 장시간 test log와 metrics artifact를 저장하십시오.
- recovery path마다 expected event sequence를 정의하십시오.
- replay validator가 event journal과 projection read model의 consistency를 검증하게 하십시오.
- UI reconnect validator가 마지막 decision, unread inbox, next action을 복원하는지 확인하십시오.
- conflict 발생 시 자동 merge 금지와 escalation을 검증하십시오.
- SupervisorDecision마다 observed state, reason, selected action, expected verification이 있는지 검증하십시오.
- AgentTaskContract 없이 시작한 work item이 없는지 검증하십시오.
- agent lease 만료 후 자동 completed 처리되지 않는지 검증하십시오.
- budget 초과 agent가 계속 실행되지 않고 supervisor decision을 요구하는지 검증하십시오.
- quota 초과 run/command가 failed가 아니라 waiting_for_capacity/backpressure로 전환되는지 검증하십시오.
- tenant fair queue가 특정 tenant/user의 독점을 막는지 검증하십시오.
- CapacityReservation 없이 heavy command/sandbox provision이 시작되지 않는지 검증하십시오.
- overload/drain mode에서 신규 heavy workload는 차단되고 approval/cancel/recovery/read-only inspection은 가능한지 검증하십시오.
- 일반 사용자 UI/API에는 quota, capacity, waiting_for_capacity, backpressure, overload, queue position 같은 내부 용어가 노출되지 않는지 검증하십시오.
- heavy workload scheduling 중에도 web/tablet/mobile이 meaningful progress 또는 next action을 제공해 답답한 dead state로 보이지 않는지 검증하십시오.
- app-server schema drift가 adapter startup을 차단하는지 검증하십시오.
- initialize 전 app-server method 호출이 차단되는지 검증하십시오.
- app-server overload error가 retry/backoff로 처리되는지 검증하십시오.
- production WebSocket dependency와 unauthenticated remote listener가 차단되는지 검증하십시오.
- app-server `thread/shellCommand`가 Core policy에서 차단되는지 검증하십시오.
- app-server `command/exec*`와 `fs/*`가 Core policy와 Workspace Runtime을 우회하지 못하는지 검증하십시오.
- app-server config/plugin/marketplace mutation method가 explicit feature flag 없이 차단되는지 검증하십시오.
- local volume backup/restore 후 event journal, projection, artifact, repository workspace가 일관적인지 검증하십시오.
- `code-server` process kill/restart 후 editor session과 workspace state reconcile을 검증하십시오.
- Gateway `code-server` proxy session 만료/폐기/재발급 경로를 검증하십시오.
- tenant/user/workspace가 다른 `code-server` session 재사용 시도를 차단하십시오.
- sandbox container kill/recreate 후 사용자 workspace가 복원되는지 검증하십시오.
- final verifier gate가 test/diff/approval 상태를 확인한 뒤에만 completed를 허용하게 하십시오.

## Verification Targets

- 3시간 synthetic run 중 data loss 0건
- multi-tenant heavy workload 중 data loss 0건
- quota 초과 command의 failed 오판 0건
- CapacityReservation 없는 heavy dispatch 0건
- tenant별 fair queue starvation 0건
- overload/drain mode에서 신규 heavy dispatch 0건
- end-user UI internal resource jargon 노출 0건
- heavy workload scheduling 중 next action/progress 없는 dead state 0건
- Portainer stack restart 후 data loss 0건
- local volume restore 후 Core replay 성공
- Core replay 후 command/state/policy mismatch 0건
- app-server schema drift 감지율 100%
- app-server adapter restart 10회 후 run completed 가능
- orchestrator restart 후 leases와 queues 복원
- workspace runtime restart 후 command 상태 reconcile
- `code-server` process kill/restart 후 editor session recover 또는 revoke/reissue 완료
- tenant 간 `code-server` session 재사용 0건
- sandbox container kill/recreate 후 workspace state reconcile
- projection rebuild 후 read model consistency 유지
- PWA reload 후 마지막 decision과 next action 복원
- mobile approval 후 web timeline에 5초 이내 반영
- conflict 발생 시 자동 merge 금지와 escalation 확인
- AgentTaskContract 없는 RoleAgent 작업 0건
- agent lease timeout 후 60초 이내 supervisor decision 기록
- budget exhaustion 후 추가 tool execution 차단
- scope violation은 자동 수정이 아니라 escalation으로 전환
- app-server `thread/shellCommand` 실행 0건
- app-server direct `command/exec*` 실행 0건
- app-server direct `fs/*` workspace mutation 0건
- unclassified app-server method 0건
- shared `code-server` process 0건
- raw `code-server` container address/password/token browser 노출 0건
- initialize handshake violation 허용 0건
- unsupported WebSocket production config 허용 0건
- final verifier gate 없이 completed transition 차단

## Required Report

`reports/durability-report.md`를 작성하십시오.

포함 항목:

- test environment
- scenario matrix
- injected failures
- observed event sequence
- metrics summary
- screenshots or UI validation artifacts
- failures found and fixed
- remaining risks

## Completion Criteria

- 장시간 작업 안정성을 수치, event log, UI 검증으로 증명합니다.
- service restart와 reconnect가 run 실패로 오판되지 않습니다.
- recovery 후에도 approval, diff, test, final review 상태가 일관됩니다.
- 제품을 실제 사용자에게 보여줄 수 있는 end-to-end confidence를 확보합니다.
