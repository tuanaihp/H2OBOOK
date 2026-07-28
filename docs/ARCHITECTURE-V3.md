# H2OBOOK V3 Integrated Architecture

## Nguyên tắc

V3 không tạo silo dữ liệu. Mọi module dùng chung các entity nền của V1/V2:

```text
Workspace
 ├─ Books / Pages / Elements / Assets
 ├─ Brands / Templates / Clones
 ├─ Publications / Classes / Students
 ├─ Products / Orders / Memberships
 └─ V3 governance & growth modules
     ├─ AI Jobs
     ├─ Reviews / Comments / Collaboration
     ├─ Automation Rules / Runs
     ├─ Licenses / Royalty Payouts
     ├─ White-label Portals
     └─ Content Health Reports
```

## Local-first adapter

`store/app-store.ts` là adapter vận hành demo. Khi production, giữ nguyên UI/action contract nhưng thay persistence bằng repository gọi Supabase/API.

## AI gateway

```text
UI → /api/v3/ai → AI_GATEWAY_URL → provider/model do H2O quản lý
```

Frontend không chứa API key và không phụ thuộc SDK của một nhà cung cấp.

## Review lifecycle

```text
draft → in_review → changes_requested → in_review → approved → published
```

Review có checklist và comment anchors tùy chọn theo page/element.

## Automation lifecycle

```text
Domain event → condition evaluation → queued run → actions → audit result
```

Production nên dùng Redis/BullMQ hoặc queue tương đương. Action `send_webhook` phải kiểm tra allowlist và ký payload.

## White-label routing

Production resolver đọc hostname, tìm `white_label_portals.custom_domain`, sau đó áp dụng theme, logo, publications và entitlement của portal.

## Security

- RLS theo organization.
- Service role chỉ dùng server-side.
- Review approval và payout có RPC kiểm tra role.
- AI prompt/output không mặc định public.
- Webhook phải ký và chống replay.
- Custom domain cần xác minh ownership trước khi active.
