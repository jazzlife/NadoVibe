# Operating Model

Target runtime is Ubuntu Server with Docker and Portainer.

Stack order:

1. `core-stack`
2. `app-server-adapter-stack`
3. `workspace-runtime-stack`
4. `gateway-projection-stack`
5. `clients-stack`
6. `ops-observability-stack`

Core persistent data classes:

- event journal
- PostgreSQL projection
- object/artifact storage
- repositories
- workspaces
- app-server state
- audit logs
- backups

Run `infra/portainer/core-stack/preflight.mjs` on the server to validate local volume root permissions before stack deployment.
