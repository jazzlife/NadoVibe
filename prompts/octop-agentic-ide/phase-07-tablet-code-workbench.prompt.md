# Phase 7 Prompt: Tablet PWA Code Workbench

## Goal

태블릿 PWA에서 실제 코드 탐색, 편집, diff 검토, 테스트 실행, 에이전트 지휘가 가능한 Code Workbench를 구현하십시오.

이 phase는 desktop UI를 단순 축소하는 작업이 아닙니다. 터치와 하드웨어 키보드를 모두 고려한 tablet-first IDE 작업면을 구현하는 작업입니다.

## Required UX

- workspace/repository header
- file tree drawer
- file search and workspace search
- CodeMirror 6 editor
- multi-file tabs
- save/revert
- dirty file indicator
- diff viewer
- hunk-level approval
- selection-to-agent command
- command palette
- coding accessory bar
- terminal/test output bottom sheet
- agent status compact rail
- optional full IDE handoff to Gateway-issued `code-server` editor session
- reconnect/recovering banner

## Tablet Requirements

- touch target 최소 44x44px
- 인접 touch target gap 최소 8px
- 768px portrait와 1024px landscape 모두 대응
- hardware keyboard shortcut 지원
- focus ring과 selection state가 명확해야 합니다.
- command palette는 tablet에서도 1급 기능입니다.
- offline 또는 reconnect 중에는 command를 자동 실행하지 마십시오. 사용자가 상태를 명확히 보고 재시도해야 합니다.
- 긴 경로와 긴 branch 이름이 UI를 밀어내지 않도록 truncation과 tooltip을 적용하십시오.
- 태블릿 사용자에게 quota, capacity, backpressure, waiting_for_capacity, overload 같은 내부 용어를 표시하지 마십시오.
- 무거운 작업이 내부적으로 scheduling 중이어도 편집, diff 검토, 선택 범위 명령 준비처럼 사용자가 계속 진행할 수 있는 흐름을 유지하십시오.

## Required Implementation

- Gateway file APIs로 file tree/read/write/search를 구현하십시오.
- Pencil 사용이 가능하거나 `.pen` design source가 있으면 touch target, split layout, drawer, bottom sheet, command palette, editor chrome의 UX를 검토하고 실제 code로 반영하십시오.
- 태블릿 기본 편집면은 Gateway file APIs와 CodeMirror 6를 사용하되, full IDE handoff가 필요하면 Gateway editor session API로 사용자/워크스페이스 sandbox 내부의 독립 `code-server`에만 연결하십시오.
- 태블릿 UI도 `code-server` raw container URL, password/token, internal path를 저장하거나 표시하지 마십시오.
- write는 WorkScope/FileLease 오류를 사용자에게 명확히 표시하십시오.
- 저장 후 git diff projection을 갱신하고 diff viewer로 연결하십시오.
- selection-to-agent command는 선택 범위, 파일 경로, run id, instruction을 command payload로 보냅니다.
- hunk approval은 approval queue와 연결하십시오.
- terminal/test bottom sheet는 streaming output과 artifact link를 표시하십시오.
- 내부 capacity 지연은 "작업 준비 중" 또는 "테스트 준비 중" 같은 제품 언어로 매핑하고, 사용자가 직접 자원을 조정하게 만들지 마십시오.
- PWA manifest, safe area, installability, service worker caching strategy를 구현하십시오.
- source code는 offline cache될 수 있지만 command execution은 online 확인 후에만 요청하십시오.

## Verification

- iPad Safari 기준 수동 확인 항목을 문서화하십시오.
- Playwright tablet viewport: file open -> edit -> save -> diff 확인
- hunk approval -> approval event 반영 테스트
- selection-to-agent command enqueue 테스트
- keyboard shortcut과 focus ring 확인
- reconnect 중 command button disabled와 상태 메시지 확인
- heavy workload scheduling 중에도 내부 자원 용어 없이 진행 상태와 가능한 next action이 표시되는지 확인
- Pencil 기반 디자인을 사용한 경우 Pencil screenshot과 tablet viewport 구현 결과 비교
- full IDE handoff가 tenant/user/workspace editor session 권한을 지키는지 확인
- touch target size 검사

## Completion Criteria

- 태블릿에서 실제 코드 수정과 에이전트 지휘가 가능합니다.
- 복잡한 diff를 hunk 단위로 검토/승인할 수 있습니다.
- 내부 자원 분배가 있어도 사용자는 답답한 대기열이 아니라 자연스러운 작업 진행 흐름을 경험합니다.
- reconnect/offline 상태에서 사용자가 오작동 없이 현재 상태와 다음 행동을 이해할 수 있습니다.
