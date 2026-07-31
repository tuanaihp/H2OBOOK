# H2OBOOK Business Commerce & Growth Operations V1 Unified

Module thống nhất 8 bề mặt Business của H2OBOOK:

- Store
- Growth Reader
- Orders & Entitlements
- Membership
- Licensing & Royalty
- Marketplace Studio
- White-label Portals
- Analytics

## Pipeline chuẩn

`Product → Campaign → Lead → Order → Payment → Entitlement → Membership/License → Distribution → Analytics`

Module chỉ cung cấp UI hợp nhất, data contract, event contract, preview route và feature flag. Khi tích hợp, Claude Code phải nối lại vào `useAppStore`, analytics SDK, checkout API, payment webhook, Growth Reader API, marketplace API và RLS hiện có. Không tạo một nguồn dữ liệu cạnh tranh.
