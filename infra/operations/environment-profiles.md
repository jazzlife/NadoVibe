# Environment Profiles

Phase 9 운영 프로파일은 `@nadovibe/core-operations`의 `QUOTA_PROFILES`와 `ops:validate`를 기준으로 검증합니다.

| Profile | Purpose | Image tag rule | Backup rule | Quota posture |
| --- | --- | --- | --- | --- |
| `local` | 개발자 단일 장비 검증 | `local` 허용 | dry-run 허용 | 작은 sandbox 동시성 |
| `staging` | Portainer stack 리허설 | 명시 tag 권장 | 배포 전 snapshot 권장 | production 축소형 |
| `production` | Ubuntu Server 실제 서비스 | `local` 금지 | Core rollout/destructive migration 전 필수 | tenant/user/workspace 공정 분배 |

필수 환경 변수:

- `NADOVIBE_ENV_PROFILE`: `local`, `staging`, `production`
- `NADOVIBE_IMAGE_TAG`: 빌드된 immutable tag
- `NADOVIBE_BUILD_VERSION`: 플랫폼 버전
- `NADOVIBE_GIT_SHA`: 배포 소스 revision
- `NADOVIBE_EVENT_SCHEMA_VERSION`: 현재 event schema version
- `NADOVIBE_MIGRATION_VERSION`: 현재 migration version
- `APP_SERVER_PROTOCOL_VERSION`: app-server adapter가 허용하는 protocol snapshot

검증:

```sh
npm run ops:validate
```

`production`에서는 기본 PostgreSQL password, `local` image tag, SYSBASE license 미승인 상태가 차단됩니다.
