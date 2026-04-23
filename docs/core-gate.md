# Phase 0 Core Gate

The first implemented slice is the Core Control Plane Kernel. Servers and agents are adapters around this kernel.

Implemented modules:

- `packages/core-events`: append-only event journal contract, optimistic concurrency, idempotency, secret payload rejection.
- `packages/core-protocol`: app-server JSON-RPC validation, initialize gate, official method policy matrix, schema registry, transport guard, overload classifier.
- `packages/core-security`: tenant isolation, destructive action approval gate, secret redaction.
- `packages/core-resource`: quota, capacity reservations, heavy-work dispatch guard, fair queue, overload drain behavior.
- `packages/core-agent`: AgentTaskContract, AgentLease, AgentBudget, SupervisorDecision validation.
- `packages/core-workspace`: WorkScope, FileLease, workspace command guard, per-workspace code-server/editor session policy.
- `packages/core-kernel`: state machines, CoreControlPlane command admission, event append, replay, SupervisorDecision completion guard.
- `services/core-control-plane`: minimal Core host with health and readiness endpoints.

Run:

```sh
npm install
npm run core:gate
```

The gate intentionally fails if a generated app-server method is not classified as `allow`, `deny`, or `route`.
