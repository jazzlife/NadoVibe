# Phase 06 Implementation Report

## 구현 범위

Phase 06 Web Agent Control Room을 현재 Core/Gateway 계약 위에 구현했습니다.

- Gateway Control Room projection API
- generated Gateway API client
- realtime stream offset reconnect entrypoint
- workspace seed, run creation, command enqueue
- approval approve/reject
- Supervisor control actions
- conflict escalation
- editor session issue/revoke UX
- file tree/read API
- diff, terminal/test output, artifact, final review gate surface
- desktop 3-pane, 1024px split, 768px tablet-compatible responsive layout
- PWA manifest와 service worker shell cache

## 주요 설계 수정

구현 중 Core `Run` aggregate에 UI projection 이벤트를 섞으면 optimistic concurrency가 깨지는 문제가 재현되었습니다.

수정:

- `RunCreated`, `RunStateChanged`, `SupervisorDecisionRecorded`는 Core `Run` aggregate가 계속 소유합니다.
- UI objective 등 read-model 보조 이벤트는 `RunProjection` aggregate로 분리했습니다.
- Gateway mutation은 계속 `core.seedIdentity`, `core.createRun`, `core.transitionRun`, `core.recordSupervisorDecision`, `core.startAgentWork`를 통과합니다.

## UX 검증

Pencil 앱은 현재 연결되지 않아 사용할 수 없었습니다. 대신 UI/UX skill 기준과 Playwright screenshot 검증으로 실제 구현 화면을 확인했습니다.

생성된 로컬 검증 아티팩트:

- `reports/artifacts/phase-06-control-room-1440.png`
- `reports/artifacts/phase-06-control-room-1024.png`
- `reports/artifacts/phase-06-control-room-768.png`

## 검증 결과

실행 명령:

```sh
npm run test
npm run test:e2e
npm run core:gate
```

결과:

- Node 테스트 43개 통과
- Playwright E2E 2개 통과
- 1440px, 1024px, 768px screenshot 생성
- compose config validation 통과
- core volume preflight 통과
- public user UI/API에서 `quota`, `capacity`, `waiting_for_capacity`, `backpressure`, `overload`, `queue position`, `password`, `token`, `container` 노출 방지 검증

## 개발 서버

현재 로컬 개발 서버는 Docker stack과 충돌하지 않도록 별도 포트로 실행했습니다.

- Gateway: `http://127.0.0.1:18080`
- Web: `http://127.0.0.1:15173`

## 다음 단계

Phase 07에서는 현재 Control Room 기반을 유지하면서 Tablet PWA Code Workbench를 구현합니다.

- CodeMirror 6 editor integration
- Gateway file write/search API 강화
- hunk-level approval interaction
- offline/reconnect command guard
- iPad Safari 수동 확인 문서화
