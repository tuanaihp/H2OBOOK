# Kiến trúc H2OBOOK Professional 4.11

## Nguyên tắc

1. Core không phụ thuộc AI.
2. Local-first để không mất thao tác.
3. PostgreSQL là nguồn dữ liệu production.
4. R2 lưu binary asset; database lưu asset ID.
5. Semantic content tách khỏi layout.
6. Tác vụ nặng chạy worker.
7. Mỗi tenant bị cô lập bởi RLS và server authorization.
8. Domain event là nền tảng webhook, automation và analytics.

## Các lớp

```text
Next.js UI
├── Smart Home / Learn / Create / Teach / Business
├── Compose Mode
├── Design Mode
├── Reader / Growth Reader
└── Enterprise / Marketplace

Application Layer
├── Repository + Domain Service
├── Server Actions / Route Handlers
├── Policy / Authorization
├── Analytics SDK
└── Optional Assist Gateway

Domain Layer
├── Semantic Content Model
├── Layout Model
├── Authoring Commands / JSON Patch
├── Publishing Profiles
├── Ingestion Rules
├── Bulk Mapping
├── Reader Campaign
└── License / Quota

Infrastructure
├── Supabase Auth + PostgreSQL + RLS
├── Cloudflare R2
├── Redis + BullMQ
├── ClamAV
├── Document Processor
├── Publishing Worker
└── Webhook Worker
```

## Dữ liệu sách

```text
Book
├── BookDocument
│   └── ContentNode tree
├── LayoutProfile
│   └── Page/Frame/Flow metadata
├── BookVersion
├── Asset references
└── Publishing artifacts
```

Sách page-based từ V1–V4 vẫn được hỗ trợ qua legacy adapter.

## Luồng save

```text
Editor local state
→ JSON Patch command history
→ Offline queue
→ Atomic semantic document API
→ PostgreSQL transaction
→ Domain event + audit
```

## Luồng publishing

```text
Semantic/Fixed content
→ Export Profile
→ Local package hoặc Publishing Queue
→ Chromium / ZIP package worker
→ R2 artifact
→ Signed download
```

## Luồng webhook

```text
Domain Event
→ PostgreSQL trigger
→ webhook_deliveries
→ claim with SKIP LOCKED
→ HMAC delivery worker
→ retry/backoff/idempotency
```

Webhook secret được mã hóa AES-256-GCM. Hash chỉ dùng để kiểm tra/nhận diện; ciphertext dùng để ký delivery.

## Luồng AI tùy chọn

```text
User action
→ Local engine có sẵn
→ Policy kiểm tra AI enabled + budget + task
→ Cache
→ Optional Gateway
→ Failure => Local result
```

AI không nằm trong đường dẫn bắt buộc của editor, publishing, reader, commerce hoặc education.
