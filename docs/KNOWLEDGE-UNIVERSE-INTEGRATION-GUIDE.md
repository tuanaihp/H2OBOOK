# Integration Guide

## 1. Copy module

Copy các thư mục sau vào repository H2OBOOK:

- `components/knowledge-universe`
- `lib/knowledge-universe`
- `app/academy/knowledge-universe`
- `tests/unit/knowledge-universe.test.ts`
- `tests/e2e/knowledge-universe.spec.ts`
- `scripts/validate-knowledge-universe-module.mjs`

## 2. Thêm package script

Merge vào `package.json`:

```json
{
  "scripts": {
    "validate:knowledge-universe": "node scripts/validate-knowledge-universe-module.mjs"
  }
}
```

## 3. Thêm feature flag

`.env.example` và Vercel Preview:

```env
NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1=true
```

## 4. Kiểm tra route demo

Mở `/academy/knowledge-universe` trước khi sửa homepage.

## 5. Tích hợp vào homepage

Trong `app/page.tsx`:

```tsx
import { KnowledgeUniverseHero } from "@/components/knowledge-universe";
import { isKnowledgeUniverseHeroEnabled } from "@/lib/knowledge-universe/feature";
```

Tách section Hero cũ thành component `LegacyPublicHero`. Sau đó:

```tsx
{isKnowledgeUniverseHeroEnabled()
  ? <KnowledgeUniverseHero />
  : <LegacyPublicHero />}
```

Không render cả hai Hero cùng lúc vì sẽ làm trang đầu quá dài và trùng thông điệp.

## 6. Kiểm tra route protection

Một số hành tinh dẫn tới route học viên/workspace. Middleware hiện tại phải tiếp tục xử lý redirect đăng nhập. Không đưa logic auth vào Hero.

## 7. Release gate

```bash
pnpm validate:knowledge-universe
pnpm validate:imports
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
