# Phase 07 Implementation Report

## 구현 범위

Phase 07 Tablet PWA Code Workbench를 Phase 06 Control Room과 같은 Gateway/Core 계약 위에 구현했습니다.

- `design/phase07.pen` Pencil 디자인 소스 작성
- `/workbench` Tablet PWA shell 추가
- CodeMirror 6 기반 파일 편집기 통합
- local esbuild 기반 CodeMirror vendor bundle 제공
- workspace file tree/read/write/search API 연결
- 선택 코드 범위 기반 agent command enqueue
- hunk 단위 approve/request changes API 및 UI
- terminal/test bottom sheet
- compact agent rail 및 full IDE session issue/revoke control
- offline/reconnect guard와 touch target 기준 적용
- service worker shell cache에 Workbench asset 추가

## 주요 설계 수정

구현/검증 중 발견한 문제를 수정했습니다.

- 파일 목록이 90개에서 잘려 deep path의 작업 파일이 보이지 않던 문제를 수정했습니다.
- 끝 개행이 있는 fixture가 CodeMirror selection range를 한 줄 더 크게 만드는 문제를 테스트 데이터에서 제거했습니다.
- 파일 목록이 페이지 전체 높이를 밀어내던 문제를 `height: 100vh`, 내부 scroll, `min-height: 0` grid 구조로 수정했습니다.
- 기존 Phase 06 E2E가 누적 editor-session 상태를 항상 미발급으로 가정하던 문제를 현재 상태 기반으로 안정화했습니다.

## UX 검증

Pencil 디자인 계약은 `phase07.pen`으로 저장했고, 구현 shell과 테스트가 같은 surface id/토큰을 기준으로 검증합니다.

생성된 로컬 검증 아티팩트:

- `reports/artifacts/phase-07-workbench-1024.png`
- `reports/artifacts/phase-07-workbench-768.png`

추가 viewport 확인:

- 375x812: horizontal overflow 0, touch target issue 0
- 768x1024: horizontal overflow 없음, document height가 viewport를 밀지 않음
- 1024x768: document height가 viewport를 밀지 않음

## 검증 결과

실행 명령:

```sh
npm run test
npm run test:e2e
npm run core:gate
```

결과:

- Node/contract 테스트 47개 통과
- Playwright E2E 4개 통과
- compose config validation 통과
- core volume preflight 통과
- Workbench edit/save/hunk approve/selected-code command/offline guard 검증 통과

## 개발 서버

현재 로컬 개발 서버:

- Gateway: `http://127.0.0.1:18080`
- Web: `http://127.0.0.1:15173`
- Phase 07 Workbench: `http://127.0.0.1:15173/workbench`
