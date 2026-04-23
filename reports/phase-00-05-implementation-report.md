# Phase 00-05 Implementation Report

## 구현 범위

Phase 00부터 Phase 05까지 프롬프트 순서대로 구현했습니다.

- Phase 00: Core Control Plane Kernel
- Phase 01: TypeScript monorepo, service shell, Portainer/local infra
- Phase 02: durable domain model, PostgreSQL event journal contract, state machines, projection rebuild
- Phase 03: Codex app-server typed integration contract, method policy, approval/event normalization
- Phase 04: Workspace Runtime policy, sandbox/code-server metadata, command planning, side-effect blocking
- Phase 05: Gateway public API contract, projection sanitization, SSE offset replay, admin capacity split

## 핵심 산출물

- `packages/core-kernel`
- `packages/core-events`
- `packages/core-protocol`
- `packages/core-workspace`
- `packages/core-resource`
- `packages/core-agent`
- `packages/domain`
- `packages/api-contract`
- `apps/gateway`
- `apps/web`
- `services/core-control-plane`
- `services/app-server-adapter`
- `services/orchestrator`
- `services/workspace-runtime`
- `services/projection-worker`
- `infra/portainer/*-stack`
- `infra/docker/sandbox.Dockerfile`
- `infra/db/001_core_event_journal.sql`

## 검증 결과

실행 명령:

```sh
npm run core:gate
```

결과:

- TypeScript build/typecheck 통과
- boundary lint 통과
- Node test 39개 통과
- Portainer/local compose static validation 통과
- Core volume preflight 통과

현재 로컬 환경에는 Docker Compose CLI가 없어 `docker compose config` 정규화는 `not_available`로 기록되었습니다. 대신 `infra/portainer/validate-stacks.mjs`가 모든 Portainer stack의 명시적 service, healthcheck, named volume, named network, bind mount 금지를 검증합니다. Ubuntu/Portainer 서버에서는 `--require-docker-compose` 옵션으로 Compose CLI까지 강제 검증할 수 있습니다.

## 남은 순서

다음 구현 순서는 Phase 06 Web Control Room입니다.

- Phase 06: Web Agent Control Room
- Phase 07: Tablet PWA Code Workbench
- Phase 08: Mobile Command and Review
- Phase 09: Operations, Update, Rollback
- Phase 10: Durability Validation
