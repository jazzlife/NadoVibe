# Local Volume Backup And Restore

대상 named volume:

- `nadovibe_postgres_data`
- `nadovibe_nats_data`
- `nadovibe_event_journal`
- `nadovibe_object_store`
- `nadovibe_repositories`
- `nadovibe_workspaces`
- `nadovibe_app_server_state`
- `nadovibe_audit_logs`
- `nadovibe_backups`

## Backup Sequence

1. 신규 heavy workload와 sandbox provision을 drain mode로 차단합니다.
2. event journal append와 projection offset을 flush합니다.
3. named volume manifest를 생성합니다.
4. local volume root 아래 volume archive와 checksum을 생성합니다.
5. backup catalog에 snapshot id, migration version, event schema version을 기록합니다.

## Restore Dry Run

`validateRestoreDryRun()`은 다음 값이 복원 전후로 일치하는지 확인합니다.

- event journal count
- projection read model count
- artifact count
- backup volume manifest

운영 명령:

```sh
npm run ops:validate
npm run durability:suite
```
