# Local Development

Install and verify:

```sh
npm install
npm run core:gate
```

Build all workspaces:

```sh
npm run build
```

Run a service after build:

```sh
node services/core-control-plane/dist/server.js
node apps/gateway/dist/server.js
node apps/web/dist/server.js
```

Validate compose files:

```sh
npm run compose:config
```

Local compose is defined in `infra/local/docker-compose.yml`. It uses read-only source mounts for development only. Portainer stacks under `infra/portainer/*-stack` use product image names and named volumes.

For Docker/Portainer development with immediate code reloads, use `infra/portainer/instant-update-dev-stacks.md`. That document defines bind-mounted `tsx watch` stacks for Core, Gateway, App-Server Adapter, Orchestrator, Workspace Runtime, Projection Worker, and Web.

`infra/local/docker-compose.yml` is a built-output smoke stack. It mounts the repository read-only at `/app`; only Workspace Runtime receives a writable `/workspace` mount so file read/write APIs can be exercised locally without exposing service code as mutable runtime state.
