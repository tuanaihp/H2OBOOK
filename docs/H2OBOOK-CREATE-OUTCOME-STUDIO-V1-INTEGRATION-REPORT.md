# H2OBOOK Create Outcome Studio V1 — Integration Report

Branch: `feature/create-outcome-studio-v1`
Source module: `v5/10-h2obook-create-outcome-studio-upgrade-v1`
Status: **READY_FOR_VERCEL_PREVIEW**

## 1. Audit summary

- No `/create` route existed before this module — no collision.
- `/assets`, `/templates`, `/design-library`, `/brand-kit` are existing flat, staff-only workspace routes (single `page.tsx` each) — left completely untouched.
- **Key finding that shaped the DB decision:** the existing book editor (`app/editor/[bookId]`, `save_book_document()` from migration 0005) is staff-only — its RLS/role check is `has_org_role(...,array['owner','admin','designer','partner','teacher'])`, which does **not** include `student`. Reusing `public.books` for learner-owned Outcome Projects would have required widening that check (and every other staff-book RLS policy) to students — a much larger, riskier change than this module needs. Per the module's own fallback rule ("Chỉ tạo `create_outcome_projects` nếu entity hiện tại không thể mở rộng an toàn"), a new, narrowly owner-scoped table was created instead (see §3).
- Reused as-is: `academy_course_lessons` (source lesson provenance), `knowledge_spaces` from module 8 (source Knowledge Space provenance), `entitlements` (membership check), `studentCareerStages` from `lib/student/experience.ts` (stage unlock, same static data already used by `/student/roadmap`), the compact student sidebar from module 9 (`lib/student/compact-navigation.ts`).

## 2. Files added/changed

**Database**
- `supabase/migrations/0027_h2obook_create_outcome_studio_v1.sql` — two new tables (`create_outcome_projects`, `create_outcome_shares`), RLS (owner-only read/write + org-staff read-only), a narrow `get_public_outcome_share()` SECURITY DEFINER RPC (mirrors `get_public_shared_result` from 0026 and `certificate_issues` from 0025 — never exposes project content or owner identity). Verified against 0001–0026 for name collisions (none found) before committing, per the lesson learned from the 0026 `assignment_submissions` collision earlier this session.
- Deliberately **not** created (documented as deferred, not silently dropped): `create_outcome_recipes` (recipe catalog is static app data, matching the existing academy-catalog convention), `create_outcome_checks` (readiness state lives in `content`/`readiness_score` columns for this pass), `create_outcome_project_assets` (asset linking deferred).

**Server logic**
- `lib/student/create-outcome.ts` — `OUTCOME_RECIPES` (5 recipes ported from the module's `outcomeRecipes.ts` at merge time, adapted so `requiredStageKey` maps directly onto the existing `studentCareerStages` ids: `foundation`/`practice`/`first-client`/`professional`/`leader`), `resolveRecipe()`, `calculateReadinessScore()`. **Correction (module 11 pass, 2026-08-03):** the original text here said "6 recipes", which was inaccurate — it was 5. Module 11's integration expanded this to 9 recipes and renamed 2 slugs to match its `DEFAULT_LEARN_CREATE_MAPPINGS`; see the module 11 report.
- `lib/learning-intelligence/service.ts` — added `contentItemId` to `KnowledgeSpaceManifest` so the Learn→Create CTA can carry real lesson provenance.

**API routes**
- `app/api/create/projects` (GET list mine / POST create-from-recipe — server re-validates any `sourceLessonId`/`sourceKnowledgeSpaceId` through the user-scoped RLS client before storing provenance, never trusting client-supplied IDs directly).
- `app/api/create/projects/[id]` (GET / PATCH content, auto-recomputes `readiness_score`/`progress_percent`/`status` server-side on every save).
- `app/api/create/projects/[id]/share` (POST — creates a public share slug; **gated at ≥60% readiness**, matching the module's "permission failure chặn export" test requirement).

**UI**
- `app/student/create/page.tsx` — Outcome Hub: hero, recipe grid resolved per learner (locked/unlocked with reason), recent-projects pointer. Accepts `?lessonId=&spaceId=` from the Learn CTA.
- `app/student/create/new/page.tsx` — Guided Wizard, compacted to 2 client-rendered steps (title confirm → source/sections summary → create) rather than 4 separate routes — see §5.
- `app/student/create/projects/page.tsx` — "Dự án của tôi" list.
- `app/student/create/projects/[id]/page.tsx` — the Guided Studio: per-section textarea form (autosave on blur), live readiness bar, "Xuất & chia sẻ" (share-link only — see §5).
- `app/verify-outcome/[slug]/page.tsx` — public, unauthenticated share page, reads only through `get_public_outcome_share()`.
- `components/student/knowledge-space-player.tsx` — added the "Tạo kết quả từ bài học này" CTA in the Knowledge Space nav header, linking to `/student/create?lessonId=...&spaceId=...`.
- `lib/student/compact-navigation.ts` / `components/student/student-shell.tsx` — CREATE group now points "Studio" and "Dự án của tôi" at the real `/student/create` routes instead of the module-9-era placeholders (`design-library`/`mentor`); "Công cụ của tôi" still points at `/student/mentor`.
- `app/globals.css` — additive CSS for `.h2oc-recipe-grid`/`.h2oc-recipe-card` and the new-CTA button; no existing selector touched.

Routes deliberately use the `/student/create/*` namespace (not a bare `/create/*` as the source prompt suggests) to stay consistent with every other learner-facing route in this repo and avoid any ambiguity with the admin/workspace top-level segments — same adapter decision already made for modules 8 and 9.

## 3. Database migration used and why

`0027_h2obook_create_outcome_studio_v1.sql`, additive. See §1 for why a new table was chosen over extending `books`. `pnpm validate:migrations` passes (27 sequential migrations); `pnpm test:sql` passes.

## 4. Security implementation

- RLS: `owner_user_id = auth.uid()` for all learner read/write on `create_outcome_projects`/`create_outcome_shares`; a separate staff-read policy for org owner/admin/teacher (full per-class instructor scoping is deferred — see §5).
- Provenance IDs (`sourceLessonId`/`sourceKnowledgeSpaceId`) are re-looked-up through the user-scoped RLS client before insert — a lookup miss silently becomes `null` rather than trusting the client, per the module's IDOR-prevention rule.
- Export/share is gated server-side at ≥60% readiness; the public verify page never reads project tables directly, only the narrow RPC.
- No `private_object_key`, service-role key, or another learner's data is ever returned to the client.

## 5. Risks / TODO (explicitly deferred)

- **Guided Studio is a structured text form, not the visual page/block editor.** Full Guided/Standard/Pro modes inside `/editor/[bookId]` (§3.4 "Studio" of the source prompt) were not built — see §1 for why (editor RLS is staff-only today). This is the single biggest scope cut in this module.
- **Export is a share link only** — no PDF/image rendering, no Facebook caption image generation, no QR code, no "send to instructor" flow yet. `create_outcome_shares.channel` supports these as values already, ready for that follow-up.
- **Wizard is 2 steps, not 4** — template picker and "start from existing content" (Ingestion reuse) steps from §3.4/§4 were not built; a project always starts from the recipe's blank section template.
- **Admin Create sidebar 4-group regrouping** (§3.2: Content Intake / Content Production / Design System / Publishing Operations) was **not** touched — the existing admin `/assets`, `/templates`, etc. routes and their navigation are unchanged, per the module's own "nếu có nguy cơ regression, giữ sidebar cũ" fallback.
- **Templates/Design Library unification** (§4 "Templates + Design Library") was not built — `/student/create` recipes are self-contained; they do not yet pull from the admin Template/Design Library catalog.
- **Personal vs Workspace Brand Kit split** was not built.
- **No new unit/integration/E2E tests were added** for this module (existing 69 tests still pass unmodified). The readiness-score and recipe-resolution logic (`lib/student/create-outcome.ts`) is pure and unit-testable — a natural next step.

## 6. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors (fixed 2 unescaped-quote errors introduced in this pass), 0 new warnings |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 27 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; all new routes present in the manifest |

Not executed: live multi-role click-through and Playwright E2E (no browser in this session) — needs a manual pass on Vercel Preview/production once migration 0027 is applied.

## 7. Manual setup remaining

1. **Apply `0027_h2obook_create_outcome_studio_v1.sql`** to the live Supabase project (via `supabase/_RUN-0027-ONLY.sql`, generated alongside this report) — nothing works under `/student/create/**` until this runs.
2. No new env vars required.
3. Click through once live: `/student` → Studio → pick "Sổ tay kiến thức của tôi" (always unlocked, no stage/membership requirement) → fill 2+ sections → confirm readiness ≥60% → "Tạo link chia sẻ" → open the resulting `/verify-outcome/[slug]` link in an incognito tab.

## 8. Safe merge steps

Same as modules 8/9: get product-owner confirmation on a Vercel Preview before merging to `main`; rollback is a plain revert since every change here is additive.
