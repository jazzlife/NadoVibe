# Security Model

- Tenant isolation is enforced by Core policy before resource access.
- Destructive actions require product `ApprovalRequest` approval.
- App-server `thread/shellCommand` is denied by default.
- App-server `command/exec*` and `fs/*` are routed through Workspace Runtime policy.
- Config, plugin, marketplace, and experimental mutation methods are denied unless a later explicit Core feature gate enables them.
- Event payloads reject secret-like keys and values.
- UI/API responses must not expose raw app-server credentials, container addresses, editor passwords, or internal filesystem paths.
- Portainer stacks use named volumes and named networks to avoid anonymous durable state.
