# Operating Model

Target runtime is Ubuntu Server with Docker and Portainer.

## Stack Order

1. `core-stack`
2. `app-server-adapter-stack`
3. `workspace-runtime-stack`
4. `gateway-projection-stack`
5. `clients-stack`
6. `ops-observability-stack`

## Persistent Data Classes

- event journal
- PostgreSQL projection
- object/artifact storage
- repositories
- workspaces
- app-server state
- audit logs
- backups

Run `infra/portainer/core-stack/preflight.mjs` on the server to validate local volume root permissions before stack deployment.

## Development Vs Production Update Model

Production and staging Portainer stacks under `infra/portainer/*-stack` run common Node service sandboxes and mount `/data/docker_data/nadovibe/runtime/current` read-only as `/app`.

Development can run inside Docker/Portainer while still applying code updates immediately. The hot-update templates are documented in `infra/portainer/instant-update-dev-stacks.md`; they bind mount the source tree and run TypeScript services with `tsx watch`.

The local compose file under `infra/local/docker-compose.yml` is a built-output smoke stack. It mounts service source read-only under `/app` and exposes the repository as a writable workspace root only for Workspace Runtime local development.

Production/staging code updates use `docs/service-sandbox-deployment.md`: prepare a release directory, validate `nadovibe.release.json`, copy the release contents into the stable current directory, then let Deployment Agent restart and verify the affected services.

## Sandbox Model

User/workspace sandboxes are Docker containers created and controlled by Workspace Runtime under Core policy. Each sandbox owns its isolated filesystem/runtime surface and its own `code-server` process. Platform services are not duplicated per sandbox.
