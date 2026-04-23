# Core Foundation Volume Policy

| Volume | Service | Data class | Backup class |
| --- | --- | --- | --- |
| `nadovibe_postgres_data` | PostgreSQL | event journal projection, command idempotency, read models | critical |
| `nadovibe_event_journal` | core-control-plane | append-only event journal spool and restore markers | critical |
| `nadovibe_audit_logs` | core-control-plane | redacted audit logs | critical |
| `nadovibe_backups` | core-control-plane | backup and restore markers | critical |
| `nadovibe_nats_data` | optional NATS | JetStream queue state when enabled | important |

All durable service data must use named Docker volumes. Anonymous volumes are not allowed for Core state.
