# Phase 4 Prompt: Workspace Runtime and Tool Gateway

## Goal

Core Control Plane Kernel이 통제하는 사용자별 코드 실행 환경, 각 sandbox 내부의 독립 `code-server`, 안전한 filesystem/git/terminal tool gateway를 구현하십시오.

이 phase는 기존 connector를 재정렬하는 작업이 아닙니다. 새 플랫폼에서 app-server와 agent orchestration이 사용할 실행면을 처음부터 만드는 작업입니다.

유저별 sandbox는 별도 Docker image로 빌드하고, 사용자/워크스페이스별 독립 container로 실행합니다. `code-server`도 이 sandbox container 내부에서만 사용자/워크스페이스별 독립 프로세스로 실행해야 하며, 공유 editor server를 만들면 안 됩니다.

## Required Service Boundary

`services/workspace-runtime`은 다음 책임을 가집니다.

- tenant/workspace별 isolated runtime provision
- user/workspace별 sandbox Docker image build and versioning
- user/workspace별 independent sandbox container lifecycle
- user/workspace별 independent `code-server` process lifecycle inside the sandbox container
- `code-server` health, restart, log, and editor session metadata
- repository clone/import/checkout
- filesystem read/write/list/search
- git status/diff/apply/commit metadata operations
- terminal command execution
- test command execution
- artifact upload/download
- resource limit, timeout, cancellation
- WorkScope, FileLease, policy 검증
- execution audit event 발행
- app-server turn cwd/sandbox/profile을 Core policy에서 파생
- local Docker volume 기반 workspace/repository/artifact persistence
- per-sandbox network/resource/volume isolation
- per-sandbox `code-server` user-data, extension, cache, and settings isolation

배치 기준:

- `services/workspace-runtime`과 `Workspace Runtime Tool Gateway`는 sandbox별로 복제하지 않는 platform service입니다.
- sandbox별로 존재하는 것은 sandbox container, `code-server`, workspace filesystem, terminal/test/build process, 필요 시 lightweight runner입니다.
- sandbox 내부 runner가 있더라도 권한 판단, WorkScope/FileLease 검증, event 기록, recovery 결정은 Core와 Workspace Runtime이 담당합니다.

`services/workspace-runtime`은 다음 책임을 가지면 안 됩니다.

- agent 계획 수립
- run 성공/실패 최종 판단
- approval UI 결정
- app-server session state 저장
- app-server `thread/shellCommand` 또는 unrestricted shell 우회 경로를 허용하지 않습니다.
- app-server `command/exec*` 또는 `fs/*`를 Workspace Runtime policy 없이 직접 실행하는 우회 경로를 허용하지 않습니다.
- shared `code-server` instance, host-level editor server, unauthenticated direct `code-server` exposure를 허용하지 않습니다.

## Required Implementation

- workspace runtime provider interface를 구현하십시오.
- sandbox image build pipeline과 image version metadata를 구현하십시오.
- sandbox image에는 검증된 `code-server` version, extension allowlist, user-data/cache root, healthcheck command를 포함하십시오.
- sandbox container naming, labels, tenant/workspace/run metadata를 구현하십시오.
- sandbox별 CPU/memory/pids/disk quota와 network policy를 구현하십시오.
- sandbox provision은 Core `CapacityReservation`을 요구해야 하며, quota가 없으면 container를 만들지 말고 `waiting_for_capacity` 상태를 기록하십시오.
- Docker cgroup limits, pids limit, memory swap policy, disk quota, log size limit을 sandbox별로 강제하십시오.
- heavy command, test, build, long-running terminal command는 Core가 발급한 command-level `CapacityReservation` 없이는 실행하지 마십시오.
- workspace runtime worker pool은 resource class별 concurrency를 분리하십시오. light file operation이 heavy build/test 때문에 굶지 않아야 합니다.
- host CPU/memory/disk/pids pressure가 임계치를 넘으면 신규 sandbox provision과 heavy command dispatch를 중단하고 Core overload signal을 발행하십시오.
- `code-server`는 sandbox 내부 loopback 또는 sandbox private network port에만 bind하고, public host port를 직접 publish하지 마십시오.
- Gateway reverse proxy가 사용할 내부 endpoint metadata는 Core event/projection으로만 발급하고, browser에는 raw container address를 노출하지 마십시오.
- editor session은 Core가 tenant/user/workspace 권한을 확인한 뒤 짧은 수명으로 발급하고, 만료/폐기/재발급 이벤트를 남기십시오.
- `code-server` password/token, extension secret, settings secret은 event journal, artifact, UI response에 기록하지 마십시오.
- `code-server` user-data, extensions, cache는 사용자/워크스페이스별 local volume 또는 명시적 volume subpath로 분리하십시오.
- sandbox recreate 시 `code-server`는 동일 workspace volume을 기준으로 재기동하고 editor session은 새 내부 endpoint로 reconcile하십시오.
- `code-server` process crash는 run 실패가 아니라 `workspace.recovering`과 `workspace.code_server_unhealthy`로 분류하고 Core recovery decision을 요구하십시오.
- 모든 runtime command는 Core command id와 idempotency key를 받아야 합니다.
- local development용 container runtime을 실제로 구성하십시오.
- workspace별 filesystem root, git repository root, artifact root를 local volume 기준으로 분리하십시오.
- sandbox volume mount는 read/write scope를 명시하고 anonymous volume을 금지하십시오.
- repository registration과 clone/import flow를 구현하십시오.
- filesystem operation은 반드시 WorkScope와 FileLease를 검증한 뒤 실행하십시오.
- git operation은 dirty state, staged state, diff size, binary file 여부를 audit event로 남기십시오.
- terminal command는 allow policy, timeout, cwd, env, redaction, output limit을 적용하십시오.
- terminal command는 declared resource class, estimated cost, max runtime, output volume budget을 요구하고 이를 audit event로 남기십시오.
- app-server가 요구하는 `cwd`, sandbox/profile, network access는 Core workspace policy에서만 생성하십시오.
- app-server `thread/shellCommand` 또는 unrestricted shell 경로를 제품 기능으로 노출하지 마십시오.
- app-server `command/exec*`와 `fs/*`는 제품 기능으로 직접 노출하지 말고, 필요 시 Core command와 Workspace Runtime operation으로 변환하십시오.
- long-running command cancellation을 구현하십시오.
- test result parser와 raw log artifact 저장을 구현하십시오.
- workspace runtime restart 후 state reconcile을 구현하십시오.
- sandbox container kill/recreate 후 local volume 기준으로 workspace state reconcile을 구현하십시오.
- secrets는 runtime에 주입하되 event journal과 UI response에 노출하지 마십시오.
- 모든 실행 결과를 event journal과 artifact metadata로 연결하십시오.

## Required APIs

- `provisionWorkspace`
- `stopWorkspace`
- `getWorkspaceStatus`
- `getEditorSession`
- `revokeEditorSession`
- `restartCodeServer`
- `registerRepository`
- `readFile`
- `writeFile`
- `listFiles`
- `searchFiles`
- `getGitStatus`
- `getGitDiff`
- `applyPatch`
- `runTerminalCommand`
- `cancelCommand`
- `runTestCommand`
- `readArtifact`

## Required Events

- `workspace.provision_requested`
- `workspace.capacity_requested`
- `workspace.capacity_reserved`
- `workspace.capacity_blocked`
- `workspace.capacity_released`
- `workspace.ready`
- `workspace.code_server_starting`
- `workspace.code_server_ready`
- `workspace.code_server_unhealthy`
- `workspace.code_server_restarted`
- `workspace.editor_session_issued`
- `workspace.editor_session_revoked`
- `workspace.repository_registered`
- `workspace.file_read`
- `workspace.file_write_requested`
- `workspace.file_written`
- `workspace.git_status_captured`
- `workspace.git_diff_captured`
- `workspace.patch_applied`
- `workspace.command_started`
- `workspace.command_output`
- `workspace.command_completed`
- `workspace.command_failed`
- `workspace.command_cancelled`
- `workspace.recovering`
- `workspace.failed`

## Verification

- tenant A가 tenant B workspace 파일을 읽지 못하는 테스트
- WorkScope 밖 파일 read/write 차단 테스트
- FileLease 충돌 테스트
- sandbox image build/version 테스트
- user A sandbox가 user B volume/network에 접근하지 못하는 테스트
- quota 초과 시 sandbox provision이 생성되지 않고 `waiting_for_capacity`로 남는 테스트
- heavy command가 CapacityReservation 없이 실행되지 않는 테스트
- heavy build/test가 file read/write 같은 light operation worker를 고갈시키지 않는 테스트
- host overload signal 시 신규 sandbox와 heavy command dispatch 차단 테스트
- user A가 user B `code-server` session, port, volume, extension data에 접근하지 못하는 테스트
- 공유 `code-server` process 또는 host-level editor server가 생성되지 않는지 테스트
- `code-server` raw container address/password/token이 Gateway response와 event journal에 노출되지 않는지 테스트
- `code-server` process kill/restart 후 workspace와 editor session reconcile 테스트
- sandbox container kill/recreate 후 workspace state 복원 테스트
- git diff/apply patch roundtrip 테스트
- terminal timeout/cancel 테스트
- app-server `thread/shellCommand` 우회 실행 차단 테스트
- app-server `command/exec*`와 `fs/*` 직접 실행 우회 차단 테스트
- unrestricted cwd/sandbox override 차단 테스트
- secret redaction 테스트
- workspace runtime restart 후 status reconcile 테스트
- command output이 event stream과 artifact에 남는 테스트

## Completion Criteria

- agent와 UI가 안전하게 파일, git, terminal, test를 사용할 수 있습니다.
- runtime이 재시작되어도 durable state와 artifact를 기준으로 복구됩니다.
- 유저별 sandbox image/container/volume/network와 `code-server` process가 독립적으로 동작합니다.
- 다중 사용자 heavy workload에서도 quota, reservation, worker pool 분리로 한 tenant/user가 runtime을 독점하지 못합니다.
- workspace runtime은 실행면 역할만 하고 판단은 Orchestrator와 Control Plane이 담당합니다.
