# Multi-User Heavy Workload Stability Report

## 결론

기존 설계는 sandbox 격리, quota, budget, lease, backpressure를 포함하고 있었지만, 여러 유저가 무거운 작업을 동시에 여러 개 구동하는 상황에서 사용자가 답답함을 느끼지 않게 자원을 분배하고 작업을 끝까지 완수하는 기준이 부족했습니다.

보강 후 설계 기준은 다음과 같습니다.

- 무거운 작업은 `CapacityReservation` 없이 실행되지 않습니다.
- quota 부족은 run 실패가 아니라 `waiting_for_capacity` 또는 queued 상태입니다.
- tenant/user/workspace별 fair queue로 특정 사용자가 platform worker를 독점하지 못합니다.
- sandbox provision, build/test, long-running terminal, app-server turn은 resource class와 quota 정책을 통과해야 합니다.
- host overload 발생 시 Core가 신규 heavy workload를 막고 recovery, approval, cancel, read-only inspection을 우선합니다.
- resource accounting은 worker memory가 아니라 event journal과 Core state로 복원됩니다.
- 일반 사용자에게 quota, capacity, waiting_for_capacity, backpressure, overload 같은 내부 제어 용어를 노출하지 않습니다.
- 사용자 경험은 "통제"가 아니라 "접수된 작업이 안정적으로 진행되고 완수되는 흐름"을 중심으로 설계합니다.

## 보강한 Core 상태

- `ResourcePool`
- `TenantQuota`
- `UserQuota`
- `WorkspaceQuota`
- `CapacityReservation`
- `RunQueueSlot`
- `CommandResourceClass`
- `OverloadSignal`

## 안정성 판단

다중 사용자 고부하 안정성은 다음 gate가 통과되어야 인정합니다.

- quota exhaustion 시 failed 오판 0건
- `CapacityReservation` 없는 heavy dispatch 0건
- tenant별 fair queue starvation 0건
- overload/drain mode 중 신규 heavy dispatch 0건
- heavy build/test가 file read/write 같은 light operation worker를 고갈시키지 않음
- reservation lease 만료, 취소, 실패, 완료 후 capacity 반환
- Core replay 후 resource accounting mismatch 0건
- 일반 사용자 화면에 quota/capacity/backpressure/waiting_for_capacity/overload 내부 용어 노출 0건
- heavy workload 지연 중에도 사용자가 볼 수 있는 의미 있는 진행 상태 또는 다음 행동 제공

## UX 원칙

- 사용자는 자원 상태를 관리하지 않습니다.
- 작업 요청은 빠르게 접수되고, 시스템이 알아서 자원을 배분합니다.
- 내부적으로 대기하더라도 가능한 lightweight analysis, planning, file scan, approval preparation을 먼저 수행해 진행감을 유지합니다.
- 지연을 설명해야 할 때도 "작업을 안정적으로 준비 중입니다" 수준의 제품 언어를 사용하고, quota나 queue 같은 운영 용어를 노출하지 않습니다.
- quota, saturation, overload, drain 정보는 admin/operator 관측면에만 표시합니다.

## 최종 판단

이 보강 이후 설계는 여러 유저가 무거운 작업을 여러 개 요청해도 사용자가 자원 상태를 직접 신경 쓰지 않게 하고, Core가 내부적으로 자원을 분배해 작업을 안정적으로 완수하는 구조입니다.

따라서 운영 가능한 안정성 기준은 "모든 작업을 즉시 무제한 실행"이 아니라 "정해진 capacity 안에서 공정하게 진행시키고, 초과분은 사용자를 방해하지 않으면서 실패 없이 내부 대기/재시도/분산 실행"입니다.
