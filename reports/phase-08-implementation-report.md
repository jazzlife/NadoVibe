# Phase 08 Implementation Report

## 구현 범위

Phase 08 Mobile Command and Review를 별도 모바일 PWA surface로 구현했습니다.

- Mobile Command Review 구현 계약을 실제 UI renderer와 contract test로 고정
- `/mobile` 모바일 전용 Command Review shell 추가
- mobile review projection API 추가
- notification inbox, read state, settings projection 추가
- platform notification permission/registration state API 추가
- service worker `push` / `notificationclick` routing 추가
- approval approve/reject 모바일 처리
- conflict escalation 모바일 처리
- recovery retry 모바일 처리
- run cancel thumb-friendly confirmation sheet 추가
- quick command template/free text/target run 지원
- final review approve/request changes 지원
- diff summary와 hunk expand 요약 표시
- offline/reconnect 중 command/decision action 잠금

## 주요 설계 수정

구현과 검증 중 발견한 문제를 수정했습니다.

- Phase 8 파일 추가 후 Phase 7 file tree가 180개 제한에 걸려 테스트 작업 파일을 찾지 못하는 회귀를 수정했습니다.
- 모바일 알림 권한이 headless 브라우저에서 `denied`로 반환되는 경우도 permission state로 명확히 표시하도록 수정했습니다.
- 누적 이벤트가 많을 때 모바일 화면이 너무 길어지지 않도록 최신 inbox/run/review 항목만 우선 표시했습니다.
- hidden confirmation sheet 버튼과 skip link가 touch target 검증에 포함되던 테스트 오류를 실제 사용자 터치 대상 기준으로 보정했습니다.

## UX 검증

초기 Pencil 산출물은 현재 저장소에서 제거했습니다. 현재 검증 기준은 실제 구현된 mobile renderer, surface id, layout token, touch target, push routing, offline/reconnect behavior, Playwright screenshot입니다.

생성된 로컬 검증 아티팩트:

- `reports/artifacts/phase-08-mobile-command-390.png`
- `reports/artifacts/phase-08-mobile-command-430.png`
- `reports/artifacts/phase-08-mobile-command-480.png`

검증 포인트:

- 첫 화면은 next action을 먼저 표시합니다.
- 모바일은 코드 편집기를 포함하지 않고 결정/명령/복구/최종 검토에 집중합니다.
- destructive run cancel은 confirmation sheet를 요구합니다.
- reconnect/offline 중 실행 action은 잠깁니다.
- 내부 자원 제어 용어와 secret성 문자열은 모바일 public surface에 노출되지 않습니다.

## 검증 결과

실행 명령:

```sh
npm run test
npm run test:e2e
npm run core:gate
```

결과:

- Node/contract 테스트 51개 통과
- Playwright E2E 8개 통과
- mobile 390px, 430px, 480px screenshot 생성
- compose config validation 통과
- core volume preflight 통과

## 개발 서버

현재 로컬 개발 서버:

- Gateway: `http://127.0.0.1:18080`
- Web: `http://127.0.0.1:15173`
- Phase 08 Mobile Command: `http://127.0.0.1:15173/mobile`
