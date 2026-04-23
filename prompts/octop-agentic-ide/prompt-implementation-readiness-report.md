# Prompt Implementation Readiness Report

## 결론

현재 프롬프트 팩은 구현 가능한 수준입니다.

단순 아이디어 문서가 아니라 다음 구현 조건을 갖추고 있습니다.

- Core-first gate
- phase별 service boundary
- required implementation
- required API/event/read model
- verification target
- completion criteria
- Ubuntu Server, Docker, Portainer stack 운영 조건
- user/workspace별 sandbox와 per-sandbox `code-server`
- app-server generated schema compatibility
- app-server method policy matrix
- 다중 사용자 heavy workload capacity 모델
- 일반 사용자 UX와 admin/operator 관측면 분리

## 공식 문서 최종 확인

OpenAI 공식 Codex App Server 문서를 기준으로 마지막 검토를 수행했습니다.

- 공식 문서: https://developers.openai.com/codex/app-server
- 확인한 핵심 항목:
  - app-server는 rich client integration boundary입니다.
  - protocol은 JSON-RPC 2.0 shape이며 wire에서 `"jsonrpc":"2.0"` header가 생략됩니다.
  - 기본 transport는 `stdio` JSONL입니다.
  - WebSocket transport는 experimental/unsupported입니다.
  - initialize/initialized handshake가 필수입니다.
  - 핵심 primitive는 `Thread`, `Turn`, `Item`입니다.
  - generated schema는 실행 중인 Codex version과 일치해야 합니다.
  - `thread/shellCommand`는 sandbox policy를 상속하지 않고 full access로 실행될 수 있습니다.
  - `command/exec*`, `fs/*`, config/plugin/marketplace mutation method 같은 side-effect surface도 generated schema에서 method policy matrix로 분류해야 합니다.

## 마지막 보강 사항

최종 점검 중 app-server side-effect method 우회 가능성을 발견해 보강했습니다.

보강된 기준:

- generated schema의 모든 app-server method는 `allow`, `deny`, `route` 중 하나로 분류합니다.
- `thread/shellCommand`는 default deny입니다.
- `command/exec*`는 Workspace Runtime routing 없이는 실행되지 않습니다.
- `fs/*`는 WorkScope/FileLease 없이는 실행되지 않습니다.
- config/plugin/marketplace mutation method는 explicit Core feature flag 없이는 차단합니다.
- unknown/unclassified method가 있으면 adapter startup을 실패시킵니다.

## 구현 가능성 판단

구현자는 다음 순서로 작업을 시작할 수 있습니다.

1. `supervisor-run.prompt.md`로 전체 run 판단 기준을 고정합니다.
2. `phase-00-core-control-plane.prompt.md`로 Core gate를 먼저 구현합니다.
3. `codex app-server generate-ts` 또는 `generate-json-schema`로 schema artifact를 생성합니다.
4. generated schema의 모든 method를 method policy matrix에 분류합니다.
5. Core command/event/state/policy/capacity/recovery test를 통과시킵니다.
6. Core gate 통과 후 phase 01부터 phase 10까지 순서대로 구현합니다.

구현 진행 원칙:

- 사용자에게 계획 승인이나 수정 승인 여부를 묻지 않고 판단하여 진행합니다.
- 잘못된 계획이나 구현은 수정, 재검증, 보고 과정을 거쳐 목적에 맞게 고칩니다.
- UI 구현에서 Pencil이 UX 품질을 높일 수 있으면 Pencil canvas, variables, screenshots를 확인해 실제 frontend code에 반영합니다.
- 구현 진행의 자율성은 제품 내부 Core safety gate와 `ApprovalRequest`를 제거하지 않습니다.

## 남은 비차단 확인 항목

아래 항목은 구현 시작을 막지는 않지만, 해당 phase에서 반드시 확인해야 합니다.

- NATS, SYSBASE 등 후보 dependency의 실제 제품명, 오픈소스 여부, 라이선스, 운영 적합성
- Ubuntu Server 실제 CPU, memory, disk, inode, pids, network capacity
- production/staging/local quota profile
- object/artifact storage 구현체
- app-server WebSocket 사용 여부. production은 stdio 기본이며 WebSocket은 명시적 auth와 feature flag 없이는 금지
- OpenAI compliance logs 식별을 위한 `clientInfo.name`과 `serviceName`

## 최종 Go 판단

구현 착수 가능합니다.

현재 프롬프트는 "무엇을 만들지"뿐 아니라 "무엇을 차단해야 하는지", "어떤 테스트를 통과해야 하는지", "장시간/고부하/재시작 상황에서 어떤 수치를 확인해야 하는지"까지 내려가 있습니다.

이제 구현의 핵심 리스크는 프롬프트 부족이 아니라, 실제 코드에서 Core gate를 우회하지 않도록 끝까지 지키는 것입니다.
