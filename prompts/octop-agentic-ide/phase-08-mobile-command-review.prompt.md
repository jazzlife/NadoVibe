# Phase 8 Prompt: Mobile Command and Review

## Goal

모바일 PWA를 코드 전체 편집이 아니라 command, approval, failure recovery, final review에 최적화하십시오.

이 phase는 desktop/tablet UI를 작게 줄이는 작업이 아닙니다. 이동 중에도 사용자가 안전하게 agent run을 지휘하고 중요한 결정을 내릴 수 있는 mobile control surface를 만드는 작업입니다.

## Required UX

- inbox
- run detail
- next action panel
- agent roster compact view
- approval review
- conflict review
- recovery decision
- quick command
- final review approval
- notification settings
- service/reconnect status

## Mobile Rules

- 첫 화면은 사용자가 처리해야 할 next action을 보여주십시오.
- 긴 diff는 summary를 먼저 보여주고 file/hunk는 필요할 때 펼치십시오.
- destructive action은 thumb-friendly confirmation을 요구하십시오.
- recovering 상태를 failed처럼 보여주지 마십시오.
- app-server/session reconnect 상태와 workspace runtime recovery 상태를 구분하십시오.
- 모바일 사용자에게 quota, capacity, backpressure, waiting_for_capacity, overload, queue position 같은 내부 자원 제어 용어를 표시하지 마십시오.
- 무거운 작업이 내부적으로 scheduling 중이면 사용자가 처리할 수 있는 승인, 리뷰, 취소, 알림 설정 같은 next action을 우선 보여주십시오.
- 모바일에서 전체 코드 편집을 억지로 구현하지 마십시오. 명확한 review와 command UX에 집중하십시오.
- push notification에서 진입하면 해당 approval/run 위치로 정확히 라우팅되어야 합니다.

## Required Implementation

- notification inbox projection을 구현하십시오.
- Pencil 사용이 가능하거나 `.pen` design source가 있으면 mobile inbox, next action, approval review, final review, push routing 화면의 thumb-friendly UX를 검토하고 실제 code로 반영하십시오.
- Web Push 또는 platform push를 선택하고 token registration, permission state, routing을 구현하십시오.
- approval approve/reject, conflict escalate, run retry/cancel, final review approve를 모바일에서 수행하게 하십시오.
- quick command는 template, free text, target run/workspace를 지원하십시오.
- diff summary는 file count, additions/deletions, risky files, test status를 표시하십시오.
- offline/reconnect 중에는 command 전송을 차단하고 durable stream offset으로 복구하십시오.
- 내부 capacity 지연은 모바일에서 알림 피로를 만들지 않도록 조용히 처리하고, 사용자 개입이 필요한 action만 push/inbox로 올리십시오.
- biometric 또는 session re-auth가 필요한 action policy를 구현하십시오.

## Verification

- push/notification click -> 정확한 review 화면 진입
- approval approve/reject E2E
- run cancel/retry E2E
- reconnect 후 inbox unread 상태 복원
- 긴 diff summary와 hunk expand 동작 확인
- destructive action confirmation 확인
- 내부 자원 용어가 모바일 inbox/run detail/push copy에 노출되지 않는지 확인
- Pencil 기반 디자인을 사용한 경우 Pencil screenshot과 mobile viewport 구현 결과 비교
- mobile 390px/430px/480px viewport screenshot 검증

## Completion Criteria

- 사용자가 모바일만으로 승인, 재시도, 중단, conflict escalation, 최종 리뷰를 수행할 수 있습니다.
- 모바일 UI는 현재 상태와 다음 action을 빠르게 판단할 수 있게 합니다.
- 모바일은 자원 상태를 관리하는 화면이 아니라 필요한 결정만 빠르게 처리하는 화면입니다.
- 모든 command는 Gateway와 durable event journal을 통해 처리됩니다.
