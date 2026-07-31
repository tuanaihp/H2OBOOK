# H2OBOOK System Governance & Operations V2 Unified

Bản V2 hợp nhất toàn bộ **System Governance**, **Infrastructure** và **Operations Center** vào một module duy nhất.

V2 thay thế hoàn toàn module V1. Không tích hợp V1 và V2 song song.

## 19 surface

### Personal & Governance

- `/account`
- `/admin`
- `/assist-control`
- `/cloud-sync`
- `/enterprise`
- `/integrations`
- `/offline`
- `/security`
- `/settings`
- `/smart-settings`

### Operations Center

- `/operations`
- `/operations/admissions`
- `/operations/approvals`
- `/operations/automation-center`
- `/operations/import-center`
- `/operations/notifications`
- `/operations/product-config`
- `/operations/support`
- `/operations/system-health`

## Kiến trúc

Module cung cấp:

- UI/UX đồng bộ cho 19 surface;
- navigation nhóm Personal, Governance và Operations;
- Preview route động;
- state tương tác cục bộ để nghiệm thu;
- type, registry, event contract và demo repository;
- feature flags, validator và unit test nền;
- contract để Claude nối vào auth, Supabase, R2, Redis/BullMQ, payment, email, health API, audit và domain event thật.

Module không tự chạy migration, không thay auth/middleware, không thay worker và không đưa secret xuống client.

## Preview

`/system-governance-ops-v2-preview/[surface]`

Ví dụ:

- `/system-governance-ops-v2-preview/admin`
- `/system-governance-ops-v2-preview/operations`
- `/system-governance-ops-v2-preview/operations-admissions`
- `/system-governance-ops-v2-preview/operations-system-health`

## Feature flags

```env
NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2=false
NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2_PREVIEW=true
```

## Nguyên tắc Production

- Preview data không phải source of truth.
- Route thật phải dùng server adapters và permission guard.
- Operations actions phải có audit, idempotency và rollback phù hợp.
- AI luôn là lớp tùy chọn; core local-first vẫn hoạt động khi AI tắt.
