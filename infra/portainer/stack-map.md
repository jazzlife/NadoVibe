# Portainer Stack Map

| Stack | Purpose | Depends on |
| --- | --- | --- |
| `core-stack` | PostgreSQL, optional NATS, Core Control Plane, durable Core volumes | none |
| `app-server-adapter-stack` | Codex app-server adapter and orchestrator service shells | `core-stack` network and volumes |
| `workspace-runtime-stack` | Workspace Runtime Tool Gateway and workspace/repository/artifact volumes | `core-stack` network |
| `gateway-projection-stack` | public Gateway and Projection Worker | `core-stack` network |
| `clients-stack` | browser-first web shell | `gateway-projection-stack` |
| `ops-observability-stack` | operational health surface, Deployment Agent, and logs | all platform stacks |

All Portainer stacks attach to named networks and use named volumes. User/workspace sandbox containers are not duplicated platform stacks; they are runtime-controlled containers created by Workspace Runtime under Core policy.

The current Workspace Runtime service exposes sandbox provision/stop endpoints and workspace file APIs. Production routing must still keep raw container ids, container ports, editor passwords, and filesystem paths behind Gateway/Core-issued sessions.

Platform services use `node:22-alpine` service sandboxes and mount the same `/data/docker_data/nadovibe/runtime/current` release read-only. Deployment Agent is the only stack service with write access to `/data/docker_data/nadovibe/runtime` and Docker restart control.

The enforced deployment order is implemented in `@nadovibe/core-operations` and validated by `npm run ops:validate`.
