# Phase 10 Durability Report

## Test Environment

- Generated at: 2026-04-23T13:20:40.905Z
- Environment: local deterministic suite
- Synthetic duration: 180 minutes
- Event count: 44

## Scenario Matrix

- PASS: 3시간 synthetic multi-agent run - 180분 synthetic time, data loss 0
- PASS: multi-tenant heavy workload saturation run - fair order tenant_a > tenant_b > tenant_c > tenant_a > tenant_b > tenant_c > tenant_a > tenant_c > tenant_b
- PASS: quota exhaustion and fair scheduling - fair order tenant_a > tenant_b > tenant_c > tenant_a > tenant_b > tenant_c > tenant_a > tenant_c > tenant_b
- PASS: host overload and drain mode - deterministic recovery path validated
- PASS: Ubuntu Server Docker/Portainer stack restart - deterministic recovery path validated
- PASS: local volume backup/restore recovery - deterministic recovery path validated
- PASS: Core Control Plane replay/recovery - deterministic recovery path validated
- PASS: app-server generated schema compatibility drift - Core protocol policy enforced
- PASS: initialize handshake violation - deterministic recovery path validated
- PASS: app-server adapter restart - Core protocol policy enforced
- PASS: Codex app-server reconnect/reattach - Core protocol policy enforced
- PASS: app-server overload and retry/backpressure - Core protocol policy enforced
- PASS: unsupported WebSocket production config - deterministic recovery path validated
- PASS: orchestrator restart - deterministic recovery path validated
- PASS: workspace runtime restart - deterministic recovery path validated
- PASS: per-user sandbox code-server process kill/restart - dedicated per tenant/user/workspace session guarded
- PASS: Gateway code-server reverse proxy reconnect/session expiry - dedicated per tenant/user/workspace session guarded
- PASS: user sandbox container kill/recreate - deterministic recovery path validated
- PASS: user sandbox image rollout/rollback - deterministic recovery path validated
- PASS: projection worker restart/rebuild - deterministic recovery path validated
- PASS: Gateway restart - deterministic recovery path validated
- PASS: PWA reload - deterministic recovery path validated
- PASS: PWA offline/online - deterministic recovery path validated
- PASS: queue disconnect/reconnect - deterministic recovery path validated
- PASS: database connection interruption - deterministic recovery path validated
- PASS: multi-agent file conflict - deterministic recovery path validated
- PASS: agent lease timeout and reassign - deterministic recovery path validated
- PASS: agent budget exhaustion and supervisor decision - deterministic recovery path validated
- PASS: RoleAgent scope violation and escalation - deterministic recovery path validated
- PASS: TaskSupervisorAgent handoff recovery - deterministic recovery path validated
- PASS: approval timeout and recovery - deterministic recovery path validated
- PASS: terminal command timeout/cancel - deterministic recovery path validated
- PASS: app-server thread/shellCommand policy violation - Core protocol policy enforced
- PASS: app-server command/exec and fs direct execution policy violation - Core protocol policy enforced
- PASS: app-server config/plugin/marketplace mutation policy violation - Core protocol policy enforced
- PASS: final verifier gate - SupervisorDecision and final review gate required

## Injected Failures

- app-server adapter restart/reconnect
- orchestrator restart with lease journal preservation
- workspace-runtime restart with command reconcile
- code-server process kill/restart and editor session reissue
- sandbox container kill/recreate from named workspace volume
- projection worker rebuild
- PWA offline/online and realtime stream reconnect
- database connection interruption and Core replay
- agent lease timeout, budget exhaustion, scope violation
- app-server method policy violations

## Observed Event Sequence

- RunCreated
- RunStateChanged:queued
- AgentTaskContractAccepted
- RecoveryQueued
- EditorSessionChanged:recovering
- ApprovalRequested
- ApprovalDecided
- ConflictEscalated
- FinalReviewGateChanged
- SupervisorDecisionRecorded
- RunStateChanged:completed

## Metrics Summary

- Event journal append latency p95: 9ms
- Projection lag: 0 events
- Realtime reconnect gap: 820ms
- Worker saturation build/test/long_running: 0.5/0.5/0.33
- Data loss count: 0
- Verification targets: 27/27 passed

## UI Validation Artifacts

- Control Room projection replay restored last SupervisorDecision and timeline offset.
- Mobile review projection restored unread inbox and next action after reconnect.
- Public projection sanitizer reported 0 internal resource-control terms.

## Failures Found And Fixed

- Phase 9/10 시작 시 version endpoint와 운영 스냅샷 API가 없어 공통 core-operations metadata로 보강했습니다.
- 장시간 복구 검증 artifact가 없어 deterministic durability suite와 reports/durability-report.md를 추가했습니다.

## Remaining Risks

- 현재 suite는 로컬 개발환경에서 3시간을 wall-clock으로 대기하지 않고 동일 이벤트 시간을 압축 시뮬레이션합니다.
- 실제 production Portainer node에서는 ops:validate 결과와 별도로 물리 디스크/네트워크 throughput 측정치를 입력해 재검증해야 합니다.
