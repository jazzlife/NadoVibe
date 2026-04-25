# Service Sandbox Deployment

NadoVibe platform services run as Docker service sandboxes. The service container provides the runtime boundary; the application code is mounted from a host release directory so updates can be applied without rebuilding service images.

## Core Rule

All platform services in one deployment must run the same mounted release:

- same `releaseId`
- same `gitSha`
- same `platformVersion`
- same `eventSchemaVersion`
- same `migrationVersion`
- same `appServerProtocolVersion`

The release manifest is the deployment source of truth:

```text
/data/docker_data/nadovibe/runtime/current/nadovibe.release.json
```

Every service reads the same manifest through:

```text
NADOVIBE_RELEASE_MANIFEST_PATH=/app/nadovibe.release.json
```

## Directory Model

```text
/data/docker_data/nadovibe/runtime
  /releases
    /<releaseId>
      nadovibe.release.json
      package.json
      node_modules
      packages
      services
      apps
      dist outputs
  /current
    active release contents copied in place
```

`/data/docker_data/nadovibe/runtime/current` is a stable directory. Do not replace it with a symlink during rollout. Docker bind mounts can stay attached to the old target if a symlink is swapped or a mounted directory is renamed. Deployment Agent updates the contents inside `current` and then restarts the affected services.

## Data Directory Rule

Production Docker volume data must stay under the server-owned Docker data root:

```text
/data/docker_data/nadovibe
  /postgres
  /nats
  /event-journal
  /object-store
  /repositories
  /workspaces
  /artifacts
  /app-server-state
  /audit
  /backups
  /logs
  /runtime
```

Portainer stacks use named Docker volumes for container ergonomics, but every non-external named volume is backed by a host directory through `driver_opts`:

```yaml
volumes:
  nadovibe_postgres_data:
    name: nadovibe_postgres_data
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${NADOVIBE_DATA_ROOT:-/data/docker_data/nadovibe}/postgres
```

This keeps volume ownership explicit and makes backup/restore paths predictable.

## Service Sandbox Rule

The Portainer stacks use a common Node runtime image and mount the current release read-only:

```yaml
image: node:22-alpine
working_dir: /app
volumes:
  - ${NADOVIBE_RUNTIME_CURRENT:-/data/docker_data/nadovibe/runtime/current}:/app:ro
```

Deployment Agent is the only service with write access to the release runtime root:

```yaml
volumes:
  - ${NADOVIBE_RUNTIME_ROOT:-/data/docker_data/nadovibe/runtime}:/data/docker_data/nadovibe/runtime:rw
  - /var/run/docker.sock:/var/run/docker.sock
```

No normal platform service writes into `/app`.

## Rollout Flow

1. Prepare a release under `/data/docker_data/nadovibe/runtime/releases/<releaseId>`.
2. Run install/build/gate in that release directory.
3. Write `nadovibe.release.json`.
4. Call Deployment Agent to plan activation.
5. Deployment Agent validates the manifest and computes affected services.
6. Deployment Agent copies release contents into `/data/docker_data/nadovibe/runtime/current` without replacing the directory itself.
7. Deployment Agent restarts affected Docker Compose services in dependency order.
8. Deployment Agent polls health endpoints.
9. Deployment Agent verifies every service `/version` response matches the manifest.

## Restart Groups

The restart order is fixed:

1. `core-control-plane`
2. `app-server-adapter`, `orchestrator`
3. `workspace-runtime`
4. `gateway`, `projection-worker`
5. `web`
6. `ops-health`

Deployment Agent itself is not restarted inside the same HTTP request. If its code changed, restart it after the rest of the rollout is verified.

## Version Drift Prevention

The rollout is invalid if any service reports a version that does not match the manifest. This prevents a mixed state such as a new Gateway talking to an old Core.

The system should fail closed:

- unknown release: block
- invalid manifest: block
- missing service container: block
- health timeout: block
- version mismatch: block
- Docker restart failure: block

Rollback uses the same mechanism: activate the previous release directory, restart affected services, and verify `/version` consistency.
