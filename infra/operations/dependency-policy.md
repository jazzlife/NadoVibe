# Dependency Policy

## NATS

- Status: optional service in `core-stack`.
- Open source: yes. The official `nats-io/nats-server` repository identifies Apache-2.0 as the license.
- Persistence: JetStream is enabled only when the `optional-nats` compose profile is selected; data must use `nadovibe_nats_data`.
- Upgrade: version pin must be reviewed with Core event replay and projection rebuild.
- Backup: include `nadovibe_nats_data` in local volume snapshot when enabled.
- Source: https://github.com/nats-io/nats-server

## SYSBASE / SAP SQL Anywhere

- Status: not selected as a default dependency.
- Open source: no product-level open-source assumption is allowed. SAP publishes Free Download Components/Third Party Terms and Product Specific License Terms for SQL Anywhere.
- Persistence: if procured later, it must be isolated behind a separate adapter and backed up through the same local volume manifest policy.
- Upgrade: requires license/procurement record, schema replay test, and backup/restore rehearsal.
- Backup: cannot replace the PostgreSQL event journal without a new migration phase.
- Source: https://www.sap.com/africa/about/trust-center/agreements/on-premise/sybase.html

## Default Decision

PostgreSQL remains the authoritative durable store for Core event journal and operational metadata. NATS remains optional for async messaging. SYSBASE/SAP SQL Anywhere is blocked unless `SYSBASE_LICENSE_ACCEPTED=true` and a separate implementation phase supplies legal and operational evidence.
