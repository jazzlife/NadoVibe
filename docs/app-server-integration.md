# App-Server Integration Contract

Checked against official OpenAI Codex app-server docs on 2026-04-23.

Adapter identity:

- `initialize.params.clientInfo.name`: `nadovibe_multi_agent_ide`
- `thread/start.serviceName`: `nadovibe.app-server-adapter`

Core enforcement:

- Generated schema artifacts must register in `AppServerSchemaRegistry`.
- Unknown methods fail registry startup.
- `initialize` and `initialized` are required before other methods.
- `thread/shellCommand` is denied.
- `command/exec*` and `fs/*` are routed to Workspace Runtime policy.
- Config/plugin/marketplace/skills mutation methods are denied until an explicit Core feature gate exists.
- WebSocket production dependency is denied unless explicitly feature-gated and authenticated.
- App-server approval requests are normalized into platform `ApprovalRequest` records.
- App-server event notifications are normalized into durable `app_server.*` platform events.

No browser API returns app-server credentials, raw listener URLs, or session tokens.
