# Phase 6 Prompt: Web Agent Control Room

## Goal

desktop web에서 멀티에이전트 IDE 플랫폼을 지휘하는 Agent Control Room을 구현하십시오.

이 phase는 기존 dashboard에 panel을 추가하는 작업이 아닙니다. 사용자가 첫 화면에서 바로 workspace, run, agent, diff, test, approval, recovery를 조작할 수 있는 실제 IDE control surface를 만드는 작업입니다.

## Required UX Structure

- workspace switcher
- repository selector
- run creation command bar
- lifecycle rail
- agent roster and hierarchy view
- Supervisor decision log
- agent contract inspector
- agent lease/budget monitor
- blocker and handoff panel
- command queue
- approval inbox
- conflict queue
- recovery queue
- timeline/event stream
- `code-server` editor session launcher or embedded editor pane
- file tree
- code/diff inspector
- terminal/test output panel
- artifact inspector
- service health strip
- final review gate

## Layout Requirements

- 1440px 이상: dense 3-pane IDE layout
- 1024px: collapsible rail + split inspector
- 768px: tablet-compatible two-column layout로 degrade
- 첫 화면은 제품 사용 화면이어야 하며 landing/marketing page를 만들지 마십시오.
- 카드 안에 카드를 중첩하지 마십시오.
- 반복 item에만 card를 사용하고 page section은 full-width 또는 unframed layout으로 구성하십시오.
- 긴 list는 virtualize 하십시오.
- status는 badge, timeline, progress marker로 명확히 표현하십시오.
- button text가 부모 너비를 넘지 않도록 responsive constraints를 설정하십시오.
- keyboard navigation과 focus ring을 구현하십시오.
- 일반 사용자 화면에는 `quota`, `capacity`, `waiting_for_capacity`, `backpressure`, `overload`, `queue position` 같은 내부 자원 제어 용어를 표시하지 마십시오.
- 무거운 작업이 내부적으로 scheduling 중이어도 timeline은 접수, 분석, 준비, 실행, 검토처럼 완수 중심의 진행감을 유지해야 합니다.

## Required Implementation

- generated API client를 사용해 Gateway와 통신하십시오.
- realtime stream을 연결하고 offset 기반 reconnect를 구현하십시오.
- Pencil 사용이 가능하거나 `.pen` design source가 있으면 canvas, variables, theme, screenshot을 확인해 Web Control Room의 layout density, visual hierarchy, interaction states를 개선하십시오.
- Pencil에서 확인한 디자인 판단은 실제 frontend code와 design tokens로 반영하고, 디자인 산출물만으로 완료 처리하지 마십시오.
- desktop web에서 full IDE가 필요할 때는 Gateway editor session API를 통해 해당 사용자/워크스페이스 sandbox 내부의 독립 `code-server`에 연결하십시오.
- UI는 `code-server` raw container URL, password/token, internal path를 저장하거나 표시하지 마십시오.
- `code-server` 상태가 `starting`, `recovering`, `expired`, `revoked`일 때 사용자가 현재 상태와 재시도/재발급 action을 명확히 볼 수 있게 하십시오.
- run 생성, command enqueue, approval approve/reject, conflict escalation, final review approve를 UI에서 수행하게 하십시오.
- SupervisorAgent control actions: pause, resume, cancel, retry, reassign, extend lease, revoke lease, accept report, reject report를 구현하십시오.
- agent hierarchy는 SupervisorAgent, TaskSupervisorAgent, RoleAgent 관계를 표시하십시오.
- agent contract inspector는 objective, WorkScope, owned files, forbidden files, budget, verification, escalation rule을 표시하십시오.
- agent lease/budget monitor는 heartbeat, timeout, retry budget, command budget, blocker age를 보여주십시오.
- RoleAgent가 직접 처리할 수 없는 scope expansion, destructive action, conflict는 handoff/escalation으로 보여주십시오.
- diff inspector는 file-level과 hunk-level review를 지원하십시오.
- terminal/test output은 streaming log와 final artifact를 모두 표시하십시오.
- recovering 상태를 failed와 시각적으로 구분하십시오.
- service health strip은 admin/operator 권한에서만 app-server adapter, orchestrator, workspace runtime, projection lag, capacity saturation을 보여주십시오.
- 일반 사용자에게는 내부 capacity 상태 대신 작업 진행 상태, 완료 예상이 가능한 경우의 부드러운 안내, 사용자가 할 수 있는 next action만 보여주십시오.
- 빈 상태는 실제 next action을 제공해야 하며, fake demo data로 성공한 것처럼 보이면 안 됩니다.

## Verification

- Playwright E2E: login -> workspace 선택 -> run 생성 -> command enqueue -> timeline 갱신
- approval 요청 표시 -> approve/reject 동작
- Supervisor control action E2E: agent pause -> reassign -> report accept
- lease timeout 표시와 recovery action 확인
- agent contract scope 밖 변경 시 escalation 표시
- realtime stream reconnect 후 누락 이벤트 복원
- `code-server` editor session 발급 -> 연결 -> 만료/폐기 후 접근 차단 E2E
- `code-server` recovering 상태와 session 재발급 UX 확인
- 1440px, 1024px, 768px screenshot 검증
- Pencil 기반 디자인을 사용한 경우 Pencil screenshot과 구현 화면의 핵심 layout/spacing/state 일치 여부 확인
- 긴 agent list와 timeline virtualization 성능 확인
- keyboard navigation과 focus ring 확인
- UI response에 secret/app-server credential이 표시되지 않는지 확인
- 일반 사용자 화면에 quota/capacity/backpressure/waiting_for_capacity/overload/queue position 용어가 노출되지 않는지 확인
- heavy workload scheduling 중에도 timeline과 next action이 답답한 dead state로 보이지 않는지 확인

## Completion Criteria

- 사용자가 web에서 run을 만들고 에이전트 조직과 작업 상태를 지휘할 수 있습니다.
- 사용자는 내부 자원 배분을 몰라도 작업이 안정적으로 진행되고 있다고 이해할 수 있습니다.
- diff, test, approval, recovery, final review가 한 control surface에서 동작합니다.
- UI는 Gateway contract와 projection read model만 사용합니다.
- full IDE 연결도 사용자/워크스페이스별 독립 sandbox `code-server`에만 연결됩니다.
