# Bridge Stability Design Report

## 결론

작업 안정성을 위해 `bridge`는 새 OctOP 멀티에이전트 IDE 플랫폼의 1급 service로 유지하지 않는 것이 맞습니다.

예전 구조에서 bridge는 app-server, workspace, filesystem, git, terminal, UI stream을 이어주는 편의 계층이었습니다. 하지만 장시간 agent 작업에서는 이런 범용 bridge가 단일 장애점과 책임 혼합을 만들 수 있습니다. 새 설계에서는 bridge를 제거하고, 책임을 명확한 service boundary로 분해합니다.

## 판단 근거

OpenAI Codex app-server는 제품 안의 리치 클라이언트 통합 경계입니다. 공식 문서 기준으로 app-server는 인증, 대화 히스토리, 승인, streamed agent event 같은 Codex 통합면을 담당합니다.

- 공식 문서: https://developers.openai.com/codex/app-server

따라서 app-server integration은 별도 `App-Server Adapter`가 맡아야 하고, workspace 파일/터미널 실행이나 플랫폼 run 판단까지 한 bridge에 합치면 책임 경계가 흐려집니다.

## Bridge 유지 시 안정성 위험

| 위험 | 설명 | 결과 |
| --- | --- | --- |
| 단일 장애점 | bridge 하나가 app-server, filesystem, terminal, event stream을 모두 잡으면 재시작 영향이 커집니다. | bridge 장애가 run 장애처럼 보입니다. |
| 상태 소유권 혼선 | bridge memory가 run, thread, terminal 상태를 임시로 갖게 됩니다. | process restart 후 상태 복원이 불안정합니다. |
| 실패 판단 오염 | transport reconnect와 실제 작업 실패가 같은 경로로 들어옵니다. | recoverable 상태가 failed로 오판됩니다. |
| 보안 경계 약화 | browser-facing stream과 workspace execution credential이 가까워집니다. | credential 노출과 권한 상승 위험이 커집니다. |
| 확장성 제한 | workspace runtime scale-out, app-server adapter scale-out, projection replay를 독립적으로 하기 어렵습니다. | multi-tenant 운영 안정성이 떨어집니다. |

## 설계 결정

`bridge`는 제거합니다. 단, bridge가 담당하던 유용한 역할은 다음 경계로 분해합니다.

| 이전 bridge 역할 | 새 설계 |
| --- | --- |
| UI 요청 중계 | `Gateway API` |
| UI 실시간 이벤트 | `Gateway Realtime Stream` |
| Codex app-server session/thread/event | `App-Server Adapter` |
| approval 전달 | `Approval Relay` in `App-Server Adapter` |
| filesystem/git/terminal 실행 | `Workspace Runtime Tool Gateway` |
| run lifecycle 판단 | `Orchestrator + Control Plane` |
| 상태 보관 | `Event Store + PostgreSQL Projection` |
| 장애 복구 | state machine, lease, checkpoint, replay |

## 새 안정성 원칙

- 모든 command는 idempotency key를 가져야 합니다.
- 모든 lifecycle 변경은 event journal에 append되어야 합니다.
- process memory는 cache일 뿐 source of truth가 될 수 없습니다.
- app-server reconnect는 `AppServerSession` state로 관리합니다.
- workspace runtime restart는 `WorkspaceRuntime` state로 관리합니다.
- run 실패 판단은 Orchestrator state machine만 수행합니다.
- Gateway stream reconnect는 durable event offset으로 복구합니다.
- terminal/file/git 실행은 WorkScope, FileLease, policy를 통과해야 합니다.
- approval은 durable `ApprovalRequest` aggregate로 관리합니다.

## 장애 시나리오별 처리

| 장애 | 새 처리 방식 |
| --- | --- |
| Gateway restart | client가 stream offset으로 재연결하고 projection에서 UI 상태를 복원합니다. |
| App-Server Adapter restart | `AppServerSession`을 `reattaching` 또는 `recovering`으로 전환하고 thread/event 재결합을 시도합니다. |
| Workspace Runtime restart | runtime status reconcile 후 command 상태를 journal과 artifact 기준으로 복원합니다. |
| Orchestrator restart | leases, queues, run state를 event journal에서 복원합니다. |
| Projection Worker restart | 마지막 offset부터 재개하고 필요 시 projection rebuild를 수행합니다. |
| Browser/PWA reload | Gateway read model과 stream offset으로 마지막 decision과 next action을 복원합니다. |

## 프롬프트 반영 사항

- README에 `Bridge 설계 결정`을 추가했습니다.
- `services/bridge` 생성을 금지했습니다.
- `approval bridge` 표현을 `approval relay`로 변경했습니다.
- bridge 책임을 `Gateway`, `App-Server Adapter`, `Workspace Runtime Tool Gateway`, `Orchestrator`, `Event Store/Projection`으로 나누도록 명시했습니다.
- bridge 재시작을 run 실패와 연결하지 말라는 수준을 넘어, bridge 자체를 새 설계의 service boundary에서 제거했습니다.

## 최종 권고

새 플랫폼에서 `bridge`라는 이름의 service, module, package를 만들지 마십시오. 이름이 남으면 구현자가 예전 구조를 되살릴 가능성이 큽니다.

필요한 것은 bridge가 아니라 다음 다섯 가지입니다.

1. browser-facing `Gateway`
2. Codex-facing `App-Server Adapter`
3. execution-facing `Workspace Runtime Tool Gateway`
4. decision-facing `Orchestrator`
5. recovery-facing `Durable Event Store + Projection`

이 구조가 장시간 멀티에이전트 작업에서 가장 안정적인 방향입니다.
