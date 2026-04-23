# Workspace Runtime Contract

- Workspace Runtime is a platform service, not a per-sandbox platform clone.
- Per user/workspace sandbox containers are created from `infra/docker/sandbox.Dockerfile`.
- Each sandbox runs its own `code-server` process bound to sandbox loopback.
- Gateway receives only Core-issued editor session routes; browser clients never receive raw container addresses or passwords.
- Sandbox provision requires a matching active `CapacityReservation`.
- Heavy runtime commands require command-level `CapacityReservation`.
- All file mutation requires WorkScope and FileLease.
- `thread/shellCommand` is blocked. `command/exec*` and `fs/*` must be converted into Core-governed Workspace Runtime operations.
- Sandbox volumes are named and explicit; anonymous volumes are denied.
