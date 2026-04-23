# Agent Control Stability Report

## 결론

현재 구조는 큰 방향에서 안정적입니다. `bridge`를 제거하고, Gateway, App-Server Adapter, Workspace Runtime, Orchestrator, Event Store/Projection을 분리했기 때문에 단일 connector 장애가 전체 run 실패로 번지는 위험은 크게 줄었습니다.

다만 기존 설계만으로는 `SupervisorAgent`가 앱 안정성을 “보장한다”고 보기에는 부족한 지점이 있었습니다. SupervisorAgent의 책임이 선언형으로는 있었지만, 실제 제어 루프, 판단 기록, 하위 agent 계약, lease/budget/scope 통제 방식이 충분히 기계적으로 정의되어 있지 않았습니다.

이번 보강으로 SupervisorAgent는 안정성 제어 루프의 소유자가 되고, 하위 Agent들은 `AgentTaskContract`, `AgentLease`, `AgentBudget`, `WorkScope`, `FileLease` 안에서만 동작하도록 설계가 강화되었습니다.

## 확인 결과

| 항목 | 기존 상태 | 판단 | 보강 |
| --- | --- | --- | --- |
| SupervisorAgent 책임 | lifecycle, queue, recovery, integration 소유로 정의됨 | 방향은 맞지만 판단 근거와 제어 루프가 부족함 | observe-decide-command-verify-recover-checkpoint 루프 추가 |
| 하위 Agent 통제 | 좁은 scope와 권한 제한 언급 | 구현자가 해석하기 쉬운 수준은 아니었음 | `AgentTaskContract` 필수화 |
| 안정성 상태 | durable event, projection, lease 존재 | source of truth는 좋음 | `SupervisorDecision`, `SupervisorCheckpoint` 추가 |
| 작업 범위 제어 | WorkScope/FileLease 있음 | 파일 실행면에는 충분하나 agent 작업 계약에는 약함 | owned/forbidden files, allowed tools, escalation rule 추가 |
| 예산/무한 실행 방지 | 명시 부족 | 장시간 agent 작업에서 위험 | `AgentBudget` 추가 |
| lease 만료 | recovering 언급 있음 | 자동 완료/실패 오판 위험 | lease 만료 시 blocked/recovering 평가 대상으로 전환 |
| UI 컨트롤 | Agent roster, queue, recovery 표시 | 관측은 가능하나 직접 통제 액션이 부족 | pause/resume/cancel/reassign/extend lease/revoke lease 추가 |
| 검증 | durability test 있음 | agent 통제 실패 시나리오 부족 | scope violation, budget exhaustion, lease timeout 검증 추가 |

## SupervisorAgent 안정성 구조

SupervisorAgent는 다음 항목을 관측해야 합니다.

- event journal
- projections
- command queue
- agent leases
- service health
- app-server session state
- workspace runtime state
- diff/test/artifact state
- approval/conflict/integration/recovery queues
- agent budget and blocker age

SupervisorAgent는 다음 결정을 독점합니다.

- run completion
- final integration
- destructive action approval path
- cross-agent conflict resolution
- broad retry/recovery strategy
- budget extension
- scope expansion
- lease revocation
- agent cancellation

중요한 판단은 모두 `SupervisorDecision` event로 기록해야 합니다.

`SupervisorDecision` 필수 필드:

- observed state
- selected action
- policy reason
- affected agents
- expected verification
- actor
- correlation id
- created timestamp

## 하위 Agent 통제 구조

모든 `TaskSupervisorAgent`와 `RoleAgent`는 작업 전에 `AgentTaskContract`를 받아야 합니다.

`AgentTaskContract` 필수 필드:

- objective
- parent run id
- parent agent id
- tenant/workspace/repository/branch context
- allowed tools
- owned files
- forbidden files
- WorkScope
- FileLease requirements
- command budget
- retry budget
- wall-clock timeout
- dependencies
- output schema
- required verification
- escalation triggers
- cancellation token
- heartbeat interval
- done criteria

하위 Agent가 할 수 있는 것:

- contract 안에서 계획
- contract 안에서 파일 수정/검증 요청
- progress report
- blocker report
- handoff request
- approval request
- partial result report

하위 Agent가 하면 안 되는 것:

- 자신의 scope 확장
- forbidden file 수정
- destructive action 직접 수행
- budget 초과 후 계속 실행
- lease 만료 후 계속 실행
- run completed 판단
- final integration 판단

## 제어 흐름

```text
SupervisorAgent
  observes durable state
  -> writes SupervisorDecision
  -> creates AgentTaskContract
  -> grants AgentLease and AgentBudget
  -> TaskSupervisorAgent / RoleAgent works inside scope
  -> agent reports progress, blocker, handoff, result
  -> SupervisorAgent verifies result
  -> accepts, rejects, reassigns, recovers, or integrates
```

## UI 컨트롤 보강

Web Control Room은 단순 관측 화면이 아니라 agent control surface여야 합니다.

필수 패널:

- Supervisor decision log
- agent contract inspector
- agent lease/budget monitor
- blocker and handoff panel
- queue panels
- recovery queue
- final review gate

필수 액션:

- pause
- resume
- cancel
- retry
- reassign
- extend lease
- revoke lease
- accept report
- reject report
- escalate conflict

## 추가된 검증 기준

- `AgentTaskContract` 없이 agent work 시작 차단
- RoleAgent scope 자체 확장 차단
- budget 초과 후 추가 tool execution 차단
- lease 만료 후 자동 completed 금지
- lease timeout 후 supervisor decision 기록
- scope violation은 자동 수정이 아니라 escalation 처리
- Supervisor-only command를 일반 RoleAgent 권한으로 호출 불가
- agent contract/lease/budget projection 복원

## 최종 판단

보강 후 구조는 SupervisorAgent가 앱 안정성을 통제하기 쉬운 형태입니다.

이유:

- SupervisorAgent가 직접 모든 일을 처리하지 않고 제어 루프와 최종 판단만 소유합니다.
- 하위 Agent는 계약, lease, budget, scope 안에서만 움직입니다.
- 모든 중요한 판단과 상태 변경이 durable event로 남습니다.
- UI는 agent 상태를 보기만 하는 것이 아니라 통제 액션을 수행할 수 있습니다.
- 장애가 발생해도 lease, queue, event journal, projection으로 복구할 수 있습니다.

남은 구현 시 주의점:

- SupervisorDecision schema를 느슨하게 만들면 안정성 장점이 사라집니다.
- AgentTaskContract 없이 “빠른 작업”을 허용하면 하위 agent 통제가 무너집니다.
- RoleAgent에 filesystem/git/terminal 직접 권한을 주면 안 됩니다. 반드시 Workspace Runtime policy와 WorkScope를 통과해야 합니다.
- UI에서 pause/cancel/reassign 같은 제어 액션이 없으면 운영자가 안정성을 체감하기 어렵습니다.
