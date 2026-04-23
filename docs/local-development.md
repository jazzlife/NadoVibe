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
