# Rollout, Drain, Rollback Policy

## Deployment Order

1. `core-stack`
2. `app-server-adapter-stack`
3. `workspace-runtime-stack`
4. `gateway-projection-stack`
5. `clients-stack`
6. `ops-observability-stack`

`validatePortainerStackOrder()`와 `npm run ops:validate`가 이 순서를 검증합니다.

## Active Run Drain

- `app-server-adapter`와 `orchestrator` 업데이트는 active run이 `running`, `waiting_for_approval`, `integrating`이면 기본 차단합니다.
- `workspace-runtime` 업데이트는 workspace lock을 잡고 active editor session을 drain 또는 reissue 계획으로 처리해야 합니다.
- `sandbox-image` 업데이트는 `code-server` version, extension allowlist, healthcheck, user-data/cache migration compatibility를 먼저 검증합니다.

## Drain Mode Admission

허용:

- approval
- cancel
- recovery
- read-only inspection
- running task completion

차단:

- 신규 heavy command
- 신규 sandbox provision

## Rollback

- event journal은 down migration보다 forward recovery를 우선합니다.
- rollback target이 현재 event schema를 읽지 못하면 rollback을 차단합니다.
- destructive migration이 적용되었으면 local volume backup snapshot 없이는 rollback을 차단합니다.
- failed rollout은 quarantine record로 남기고 stable version으로 route를 되돌립니다.

## Canary

canary rollout은 tenant allowlist에 있는 tenant만 새 version으로 route합니다. 그 외 tenant는 stable version을 유지합니다.
