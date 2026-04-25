# Portainer Instant-Update Development Stacks

이 문서는 개발 단계에서 **Docker/Portainer 안에서 구동하되 코드 수정이 즉시 반영되는** Core stack과 user-sandbox stack 템플릿입니다.

운영/스테이징용 `infra/portainer/*-stack/docker-compose.yml`은 `docs/service-sandbox-deployment.md`의 mounted release 모델을 사용합니다. 이 문서의 stack은 개발 중 파일 저장 즉시 재시작되는 `tsx watch` 전용입니다.

## 전제

Ubuntu 개발 서버에 소스가 bind mount 가능한 경로로 존재해야 합니다.

```sh
sudo mkdir -p /data/docker_data/nadovibe/source
sudo chown -R "$USER":"$USER" /data/docker_data/nadovibe/source
git clone https://github.com/jazzlife/NadoVibe.git /data/docker_data/nadovibe/source
```

소스 업데이트는 host에서 `git pull`, `rsync`, 또는 편집 도구로 `/data/docker_data/nadovibe/source`를 갱신하면 됩니다. TypeScript 서비스는 `tsx watch`가 재시작합니다.

의존성 변경(`package.json`, `package-lock.json`)은 `node-deps` 서비스를 한 번 재시작하십시오.

```sh
docker compose restart node-deps
```

## Stack 1: Core Instant-Update Dev

Portainer에서 새 stack을 만들고 아래 compose를 붙여 넣으십시오.

권장 stack name: `nadovibe_core_hot_dev`

```yaml
name: nadovibe_core_hot_dev

x-nadovibe-dev-env: &nadovibe-dev-env
  NADOVIBE_ENV_PROFILE: local
  NADOVIBE_IMAGE_TAG: dev-bind
  NADOVIBE_BUILD_VERSION: 0.1.0
  NADOVIBE_GIT_SHA: dev-bind
  NADOVIBE_EVENT_SCHEMA_VERSION: 1
  NADOVIBE_MIGRATION_VERSION: 3
  APP_SERVER_PROTOCOL_VERSION: official-docs-2026-04-23

x-node-service: &node-service
  image: node:22-alpine
  working_dir: /app
  restart: unless-stopped
  volumes:
    - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
    - nadovibe_dev_node_modules:/app/node_modules
  depends_on:
    node-deps:
      condition: service_healthy
  networks:
    - nadovibe_dev_net

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-nadovibe}
      POSTGRES_USER: ${POSTGRES_USER:-nadovibe}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-nadovibe_dev}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10
    volumes:
      - nadovibe_dev_postgres:/var/lib/postgresql/data
    networks:
      - nadovibe_dev_net

  nats:
    image: nats:2.10-alpine
    restart: unless-stopped
    command: ["-js", "-sd", "/data", "-m", "8222"]
    profiles: ["optional-nats"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8222/healthz >/dev/null"]
      interval: 10s
      timeout: 5s
      retries: 10
    volumes:
      - nadovibe_dev_nats:/data
    networks:
      - nadovibe_dev_net

  node-deps:
    image: node:22-alpine
    working_dir: /app
    restart: unless-stopped
    command: ["sh", "-lc", "npm install && touch /app/node_modules/.nadovibe-dev-ready && tail -f /dev/null"]
    volumes:
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
    healthcheck:
      test: ["CMD-SHELL", "test -f /app/node_modules/.nadovibe-dev-ready"]
      interval: 5s
      timeout: 5s
      retries: 60
    networks:
      - nadovibe_dev_net

  core-control-plane:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false services/core-control-plane/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      CORE_CONTROL_PLANE_PORT: 18081
      NODE_ENV: development
      DATABASE_URL: postgresql://${POSTGRES_USER:-nadovibe}:${POSTGRES_PASSWORD:-nadovibe_dev}@postgres:5432/${POSTGRES_DB:-nadovibe}
    ports:
      - "18081:18081"
    depends_on:
      node-deps:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18081/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30
    volumes:
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
      - nadovibe_dev_event_journal:/var/lib/nadovibe/event-journal
      - nadovibe_dev_app_server_state:/var/lib/nadovibe/app-server-state
      - nadovibe_dev_audit:/var/log/nadovibe/audit
      - nadovibe_dev_backups:/var/backups/nadovibe

  app-server-adapter:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false services/app-server-adapter/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      APP_SERVER_ADAPTER_PORT: 18091
    ports:
      - "18091:18091"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18091/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30
    volumes:
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
      - nadovibe_dev_app_server_state:/var/lib/nadovibe/app-server-state
      - nadovibe_dev_adapter_logs:/var/log/nadovibe/adapter

  orchestrator:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false services/orchestrator/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      ORCHESTRATOR_PORT: 18092
    ports:
      - "18092:18092"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18092/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30
    volumes:
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
      - nadovibe_dev_orchestrator_logs:/var/log/nadovibe/orchestrator

  workspace-runtime:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false services/workspace-runtime/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      WORKSPACE_RUNTIME_PORT: 18093
      WORKSPACE_RUNTIME_DOCKER_ENABLED: "true"
      DOCKER_SOCKET_PATH: /var/run/docker.sock
      WORKSPACE_RUNTIME_SINGLE_WORKSPACE_ROOT: /app
      WORKSPACE_RUNTIME_FILE_LEASE_TTL_MS: 600000
    ports:
      - "18093:18093"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18093/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
      - nadovibe_dev_repositories:/var/lib/nadovibe/repositories
      - nadovibe_dev_workspaces:/var/lib/nadovibe/workspaces
      - nadovibe_dev_artifacts:/var/lib/nadovibe/artifacts
      - nadovibe_dev_workspace_logs:/var/log/nadovibe/workspace-runtime

  projection-worker:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false services/projection-worker/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      PROJECTION_WORKER_PORT: 18094
      CORE_CONTROL_PLANE_URL: http://core-control-plane:18081
    ports:
      - "18094:18094"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18094/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30
    volumes:
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/app:rw
      - nadovibe_dev_node_modules:/app/node_modules
      - nadovibe_dev_projection_logs:/var/log/nadovibe/projection-worker

  gateway:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false apps/gateway/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      GATEWAY_PORT: 18080
      CORE_CONTROL_PLANE_URL: http://core-control-plane:18081
      WORKSPACE_RUNTIME_URL: http://workspace-runtime:18093
    ports:
      - "18080:18080"
    depends_on:
      node-deps:
        condition: service_healthy
      core-control-plane:
        condition: service_healthy
      workspace-runtime:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:18080/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30

  web:
    <<: *node-service
    command: ["sh", "-lc", "npx tsx watch --clear-screen=false apps/web/src/server.ts"]
    environment:
      <<: *nadovibe-dev-env
      WEB_PORT: 15173
      GATEWAY_BASE_URL: http://127.0.0.1:18080
    ports:
      - "15173:15173"
    depends_on:
      node-deps:
        condition: service_healthy
      gateway:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:15173/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 30

volumes:
  nadovibe_dev_node_modules:
    name: nadovibe_dev_node_modules
  nadovibe_dev_postgres:
    name: nadovibe_dev_postgres
  nadovibe_dev_nats:
    name: nadovibe_dev_nats
  nadovibe_dev_event_journal:
    name: nadovibe_dev_event_journal
  nadovibe_dev_app_server_state:
    name: nadovibe_dev_app_server_state
  nadovibe_dev_audit:
    name: nadovibe_dev_audit
  nadovibe_dev_backups:
    name: nadovibe_dev_backups
  nadovibe_dev_repositories:
    name: nadovibe_dev_repositories
  nadovibe_dev_workspaces:
    name: nadovibe_dev_workspaces
  nadovibe_dev_artifacts:
    name: nadovibe_dev_artifacts
  nadovibe_dev_adapter_logs:
    name: nadovibe_dev_adapter_logs
  nadovibe_dev_orchestrator_logs:
    name: nadovibe_dev_orchestrator_logs
  nadovibe_dev_workspace_logs:
    name: nadovibe_dev_workspace_logs
  nadovibe_dev_projection_logs:
    name: nadovibe_dev_projection_logs

networks:
  nadovibe_dev_net:
    name: nadovibe_dev_net
    driver: bridge
```

확인 URL:

- Web: `http://<host>:15173`
- Gateway: `http://<host>:18080`
- Core: `http://<host>:18081/version`
- App-Server Adapter: `http://<host>:18091/version`
- Orchestrator: `http://<host>:18092/version`
- Workspace Runtime: `http://<host>:18093/version`
- Projection Worker: `http://<host>:18094/version`

## Stack 2: User Sandbox Instant-Update Dev

이 stack은 사용자/워크스페이스별 sandbox 템플릿입니다. 실제 운영에서는 Workspace Runtime이 Core 정책에 따라 sandbox container를 생성해야 합니다. 개발 중에는 Portainer에서 tenant/user/workspace별로 이 stack을 별도 배포해 빠르게 확인할 수 있습니다.

권장 stack name: `nadovibe_sandbox_dev_<tenant>_<user>_<workspace>`

host 준비:

```sh
sudo mkdir -p /data/docker_data/nadovibe/sandboxes/dev-tenant/dev-user/dev-workspace/workspace
sudo mkdir -p /data/docker_data/nadovibe/sandboxes/dev-tenant/dev-user/dev-workspace/repository
sudo chown -R 1000:1000 /data/docker_data/nadovibe/sandboxes
```

Portainer environment variables 예시:

```env
NADOVIBE_SOURCE_ROOT=/data/docker_data/nadovibe/source
NADOVIBE_TENANT_ID=dev-tenant
NADOVIBE_USER_ID=dev-user
NADOVIBE_WORKSPACE_ID=dev-workspace
NADOVIBE_RUN_ID=dev-run
NADOVIBE_CODE_SERVER_PORT=19080
NADOVIBE_SANDBOX_IMAGE=nadovibe/sandbox:local
NADOVIBE_SANDBOX_ROOT=/data/docker_data/nadovibe/sandboxes/dev-tenant/dev-user/dev-workspace
```

compose:

```yaml
name: nadovibe_user_sandbox_hot_dev

services:
  user-sandbox:
    image: ${NADOVIBE_SANDBOX_IMAGE:-nadovibe/sandbox:local}
    restart: unless-stopped
    init: true
    working_dir: /workspace
    command:
      - "bash"
      - "-lc"
      - >
        mkdir -p /home/coder/.local/share/code-server/extensions /home/coder/.cache/code-server /workspace /artifacts &&
        code-server
        --bind-addr 0.0.0.0:8080
        --auth none
        --user-data-dir /home/coder/.local/share/code-server
        --extensions-dir /home/coder/.local/share/code-server/extensions
        /workspace
    environment:
      NADOVIBE_ENV_PROFILE: local
      NADOVIBE_TENANT_ID: ${NADOVIBE_TENANT_ID:-dev-tenant}
      NADOVIBE_USER_ID: ${NADOVIBE_USER_ID:-dev-user}
      NADOVIBE_WORKSPACE_ID: ${NADOVIBE_WORKSPACE_ID:-dev-workspace}
      NADOVIBE_RUN_ID: ${NADOVIBE_RUN_ID:-dev-run}
      CODE_SERVER_BIND_ADDR: 0.0.0.0:8080
    labels:
      com.nadovibe.managed-by: "portainer-dev"
      com.nadovibe.tenant: "${NADOVIBE_TENANT_ID:-dev-tenant}"
      com.nadovibe.user: "${NADOVIBE_USER_ID:-dev-user}"
      com.nadovibe.workspace: "${NADOVIBE_WORKSPACE_ID:-dev-workspace}"
      com.nadovibe.run: "${NADOVIBE_RUN_ID:-dev-run}"
    ports:
      - "127.0.0.1:${NADOVIBE_CODE_SERVER_PORT:-19080}:8080"
    volumes:
      - ${NADOVIBE_SANDBOX_ROOT:-/data/docker_data/nadovibe/sandboxes/dev-tenant/dev-user/dev-workspace}/workspace:/workspace:rw
      - ${NADOVIBE_SANDBOX_ROOT:-/data/docker_data/nadovibe/sandboxes/dev-tenant/dev-user/dev-workspace}/repository:/workspace/repository:rw
      - ${NADOVIBE_SOURCE_ROOT:-/data/docker_data/nadovibe/source}:/platform:ro
      - sandbox_codeserver:/home/coder/.local/share/code-server
      - sandbox_cache:/home/coder/.cache/code-server
      - sandbox_artifacts:/artifacts
    cpus: "${NADOVIBE_SANDBOX_CPUS:-2}"
    mem_limit: ${NADOVIBE_SANDBOX_MEMORY:-4g}
    pids_limit: ${NADOVIBE_SANDBOX_PIDS:-512}
    ulimits:
      nofile:
        soft: 4096
        hard: 8192
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1:8080/healthz >/dev/null"]
      interval: 10s
      timeout: 5s
      retries: 30
    networks:
      - sandbox_dev_net

volumes:
  sandbox_codeserver:
    name: ${NADOVIBE_CODESERVER_VOLUME:-nadovibe_codeserver_dev}
  sandbox_cache:
    name: ${NADOVIBE_CODESERVER_CACHE_VOLUME:-nadovibe_codeserver_cache_dev}
  sandbox_artifacts:
    name: ${NADOVIBE_ARTIFACT_VOLUME:-nadovibe_artifacts_dev}

networks:
  sandbox_dev_net:
    name: ${NADOVIBE_SANDBOX_NETWORK:-nadovibe_sandbox_dev_net}
    driver: bridge
```

확인 URL:

- code-server: `http://127.0.0.1:${NADOVIBE_CODE_SERVER_PORT:-19080}`

개발 전용으로만 raw code-server port를 localhost에 publish합니다. production에서는 Gateway가 발급한 editor session/reverse proxy 경로만 사용하고 container address, token, password를 browser API에 노출하지 않습니다.

## 업데이트 동작 기준

| 변경 대상 | 즉시 반영 방식 | 필요한 조치 |
| --- | --- | --- |
| Core/Gateway/Web/Service TypeScript 코드 | `/data/docker_data/nadovibe/source` bind mount + `tsx watch` | 파일 저장 또는 `git pull` |
| UI/CSS/HTML 렌더 코드 | Web container `tsx watch` | 브라우저 새로고침 |
| Gateway/API 코드 | Gateway container `tsx watch` | 요청 재시도 |
| package dependency | `nadovibe_dev_node_modules` named volume | `node-deps` 재시작 |
| user workspace 파일 | sandbox workspace bind mount | code-server에서 즉시 반영 |
| sandbox tool/helper 코드 | `/platform` read-only source mount | host source 갱신 |
| code-server version, OS package, base image | image layer | sandbox image rebuild 필요 |

## 운영 stack과의 경계

- 이 문서의 compose는 개발 전용입니다.
- bind mount를 허용합니다.
- `NADOVIBE_IMAGE_TAG=dev-bind`를 사용합니다.
- production/staging stack에는 이 `tsx watch` 구성을 적용하지 않습니다.
- production/staging은 `node:22-alpine` service sandbox, `/data/docker_data/nadovibe/runtime/current` mounted release, Deployment Agent, rollout/drain/rollback 정책을 사용합니다.
