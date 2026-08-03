# H2OBOOK Learning Intelligence V3 — Integration Report

Branch: `feat/h2obook-learning-intelligence-v3`
Source module: `v5/8-h2obook-learning-intelligence-v3-final`
Status: **READY_FOR_VERCEL_PREVIEW** (core vertical slice; several sections intentionally scoped down — see §9 below)

## 1. Audit summary

- Stack: Next.js 15 App Router, React 19, TypeScript, Supabase Postgres + Auth + RLS, Cloudflare R2, feature-flag-gated modules (`NEXT_PUBLIC_*`).
- Auth: `requireApiUser()` / `resolveOrganizationAccess()` (`lib/auth/api.ts`) for API routes; `requireCurrentUser()` for server pages. Two Supabase client flavors: `createSupabaseAdminClient()` (service role, bypasses RLS) and `createSupabaseServerClient()` (anon key + user session cookies, RLS-scoped).
- This repository already has a **Learning Commerce base** that is functionally equivalent to V3's own `types.ts` (ContentItem/Roadmap/Product/Membership/Entitlement): `products`, `orders`, `order_items`, `memberships`, `entitlements` (0002), and `academy_courses` → `academy_course_modules` → `academy_course_lessons` → `academy_lesson_progress` (0024). Payment webhook (`app/api/payments/webhook/[provider]/route.ts`) already verifies signatures, is idempotent via `payment_events`, auto-provisions student accounts, and grants entitlements via `mark_order_paid()`.
- R2: `lib/storage/r2.ts` already provides private signed upload/download URLs (5–15 min TTL) — reused as-is, no changes needed.
- **Decision: Case C (adapter)**, per the module's own decision tree. `CONSOLIDATED_SCHEMA_V3.sql` was **not** applied. Only the genuinely new "Brain Learning" layer — Knowledge Space authoring, Brain Map, Experience Vault, grading, Journal, Result/Share, Brain Assistant search — was added, wired onto the existing schema. `ContentItem` (V3) → `public.academy_course_lessons` (existing); one lesson can carry at most one Knowledge Space (`unique(content_item_id)`).

## 2. Files added/changed

**Database**
- `supabase/migrations/0026_h2obook_learning_intelligence_v3.sql` — 21 new tables (knowledge_spaces, knowledge_space_versions, learning_sections, learning_blocks, knowledge_nodes/edges, completion_conditions, brain_templates, experience_cases, rubrics/rubric_criteria, assignment_definitions/submissions, block_progress, knowledge_space_progress, learner_notes, learner_experiences, learning_results, share_card_templates, shared_results, journal_entries, knowledge_chunks), full RLS on every table, helper functions `has_lesson_entitlement()` / `has_space_entitlement()`, publishing RPCs `learning_publish_space_version()` / `learning_publish_due_space_versions()` (service-role/cron only), keyword-search RPC `learning_match_knowledge_chunks()`, and a narrow public RPC `get_public_shared_result()` for share pages.
- `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql` — regenerated to include 0026 (still 26 files total after the Aug-1 production run; **this file must be re-run/appended on the live Supabase project before this branch can be exercised against real data** — it has not been applied to `oamczuibcgjqmjxqntsn` yet).

**Server logic**
- `lib/learning-intelligence/service.ts` — `buildStudentManifest()` (RLS-driven published-manifest assembly), `recomputeSpaceProgress()` (weighted block-progress aggregation), `slugify()`.
- `lib/academy/student-course.ts` — added `knowledgeSpaceSlug` to `StudentLesson`, resolved via a join against `knowledge_spaces`.

**API routes** (`app/api/learning/**`, `app/api/brain/assistant/route.ts`)
- `spaces` (list/create), `spaces/[id]` (get/patch), `spaces/[id]/versions` (create draft, optional clone), `versions/[id]` (get detail incl. sections+blocks / patch meta), `versions/[id]/publish` (RPC call via user-scoped client so `auth.uid()` resolves), `versions/[id]/sections`, `sections/[id]` (patch/delete), `sections/[id]/blocks` (create, with a minimal per-type payload validator), `blocks/[id]` (patch/delete), `manifest/[slug]` (student read, RLS-only), `progress` (block-id-only input; org/space/version always resolved server-side, never trusted from the client), `notes`, `lessons` (picker for the create-space form).
- `brain/assistant` — rate-limited (20/min/user), keyword-search tier only.

**UI**
- `app/instructor/brain-studio/page.tsx` + `app/instructor/brain-studio/[spaceId]/page.tsx` — H2O Brain Content Studio: create a space from an unlinked lesson, add/remove sections, add/edit/remove blocks (type picker + JSON payload editor), create a new draft version (optionally cloned), publish. Reuses the existing `SimpleOperationsShell` + `operations.module.css` design system and the existing `instructorRoutes` nav (added a "H2O Brain Studio" entry) — no new admin shell was built.
- `app/student/spaces/[slug]/page.tsx` + `components/student/knowledge-space-player.tsx` (+ CSS module) — the 3-pane learner experience (Navigator / Canvas / Intelligence Panel): section/block navigation with per-block completion state, dedicated renderers for `checklist`/`video`/`rich_text`/`case_study`/`before_after` blocks (others fall back to a generic text view), manual progress tracking wired to `/api/learning/progress`, a notes panel, and a Brain Assistant chat panel (keyword-tier only).
- `components/student/course-player.tsx` — added a "Học ngay" button that appears once a lesson has a published Knowledge Space, linking to `/student/spaces/[slug]`. This is the only discovery path wired in this pass (Roadmap Builder / admin catalog surfacing is not yet touched — see §9).
- `lib/operations/routes.ts` — added the Brain Studio nav entry.

## 3. Database migration used and why

`0026_h2obook_learning_intelligence_v3.sql`, additive (Case C). No existing table was renamed, altered destructively, or duplicated. `pgvector`/embeddings are deferred — `knowledge_chunks` ships with a `tsvector` keyword-search column now (`to_tsvector('simple', ...)`), with a TODO comment for the ivfflat/embedding upgrade once the Supabase project's `vector` extension is confirmed available. `pnpm validate:migrations` passes (26 sequential migrations).

## 4. Security implementation

- **Entitlement**: inherited from the existing lesson/course chain via `has_lesson_entitlement()` / `has_space_entitlement()` (SQL, `security definer`), reused consistently across every new RLS policy — no entitlement logic is duplicated in application code, per the module's own rule ("API/page không tự tính quyền bằng local state. Dùng server RPC/RLS.").
- **Block payload gating**: enforced at the database layer. `learning_blocks` RLS only exposes `visibility='preview'` rows to anyone (once the parent version is published) and `visibility='all_entitled'` rows only to entitled learners; `instructor`/`admin` visibility blocks are staff-only. A guest or non-entitled learner querying the table directly gets zero rows for gated content — not just a UI-level hide.
- **Version integrity**: Published versions cannot be edited — every write API route checks `status='draft'` before allowing section/block mutation, and `learning_publish_space_version()` supersedes the prior published version inside the same transaction rather than allowing two "published" versions to coexist.
- **Progress writes**: `/api/learning/progress` accepts only a `blockId`; organization/space/version are always resolved server-side from that block, so a client can never write progress into a space/org it doesn't belong to.
- **Public share pages**: no SELECT policy is granted on `learning_results` or `shared_results` directly; the only public-facing surface is `get_public_shared_result(slug)`, a narrow `security definer` RPC returning just the achievement fields (mirrors the existing `certificate_issues` pattern from 0025).
- **R2**: reused as-is (`lib/storage/r2.ts`); no object keys are returned to the browser by any new route.

## 5. Routes added

- Admin: `/instructor/brain-studio`, `/instructor/brain-studio/[spaceId]`.
- Student: `/student/spaces/[slug]`.
- API: 13 routes under `/api/learning/**` + `/api/brain/assistant` (listed in §2).

No existing route was moved, renamed, or had its behavior changed, except the two lines added to `course-player.tsx` (a new conditional button) and the new `knowledgeSpaceSlug` field on `StudentLesson` (additive, optional).

## 6. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 49 pre-existing warnings (2 new, both `react-hooks/exhaustive-deps` on intentional mount-only effects — same pattern already used elsewhere in this codebase, e.g. `app/assets/page.tsx`) |
| `pnpm test` (vitest) | ✅ 21 files / 69 tests passed — no regressions, no new unit tests added for this module (see §9) |
| `pnpm test:sql` | ✅ passed (19 domain tables — this static checker was not extended to the 21 new tables in this pass) |
| `pnpm validate:migrations` | ✅ 26 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully, all new routes appear in the route manifest |

**Not executed**: `pnpm test:e2e` (Playwright) and RLS role-switch tests against a live database — the migration has not yet been applied to the real Supabase project, so there is nothing to run E2E/RLS tests against yet (see §9).

## 7. Build result

Production build succeeded. New routes confirmed in the manifest: `/instructor/brain-studio`, `/instructor/brain-studio/[spaceId]`, `/student/spaces/[slug]`, and all 14 new API routes.

## 8. Manual setup remaining

1. **Apply migration 0026 to the live Supabase project** (`oamczuibcgjqmjxqntsn`) — append it to a run of `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql` (already regenerated) or run `0026_h2obook_learning_intelligence_v3.sql` alone via the SQL Editor, since 0001–0025 are already applied.
2. No new env vars are required — this module reuses existing Supabase/R2 configuration.
3. Deploy to Vercel Preview and click through: create a Knowledge Space from an existing lesson → add a section + a `checklist` block → publish → open `/student/spaces/[slug]` as a student with course access → check off the checklist → confirm progress updates → leave a note → ask the Brain Assistant a question about the block content.

## 9. Risks / TODO (explicitly deferred, not silently dropped)

This is a large module (21 sections in the source prompt). To ship a genuinely working, typed, RLS-secured, build-clean vertical slice rather than a half-wired surface across all 21 sections, the following were deliberately scoped out of this pass:

- **AI/RAG tier of the Brain Assistant** (§12): only the keyword-search fallback tier is implemented. Embeddings, citations-with-block-deep-links beyond a label, and the provider-abstraction wiring are not built. The entitlement gate (`has_space_entitlement()` inside `learning_match_knowledge_chunks()`) is already in place so the future AI tier has a safe foundation to build on.
- **Assignment submission + grading UI** (§7): the schema (`assignment_definitions`, `assignment_submissions`, `rubrics`, `rubric_criteria`) and RLS are in place, but no API routes or UI were built for students to submit or instructors to grade. `assignment`/`quiz`/`reflection` blocks currently render as generic read-only text in the student player.
- **Experience Vault** (§6): schema + RLS only (`experience_cases`, `learner_experiences`). No authoring or moderation UI.
- **Brain Map visual graph** (`knowledge_nodes`/`knowledge_edges`): schema + RLS only; no graph-rendering UI.
- **Result issuance + Share Center image generation** (§14): schema + the public share RPC exist; no route creates `learning_results` rows yet, and no share-card image rendering was built.
- **Journal export** (§13): schema only; no Markdown/PDF export route.
- **Analytics events** (§17): not wired — no `space_viewed`/`block_completed`/etc. events are emitted yet.
- **Drag-and-drop section/block reordering and a rich block-payload editor**: the current Brain Studio UI uses a JSON textarea for block payload and up-front insert-at-end ordering (no drag handles). Functional, not polished.
- **No Roadmap Builder integration**: the only discovery path wired is the "Học ngay" button on the existing course lesson player. The Roadmap Builder card/shortcut described in §9 of the source prompt was not touched in this pass.
- **No dedicated unit/RLS/E2E tests were added** for the new tables/routes (existing 69 tests still pass unmodified). RLS behavior was reasoned through manually (see §4) but not exercised against a live database, since migration 0026 has not been applied to Supabase yet.
- **`brain_templates`** table exists with RLS but no seed data or "start from template" UI flow.

None of the above blocks the core loop from working end-to-end (author a Knowledge Space → publish → student completes checklist/video/text blocks → progress tracked → notes taken → keyword-search assistant answers questions), which is what was prioritized.

## 10. Safe merge steps

1. Apply `0026_h2obook_learning_intelligence_v3.sql` to the Supabase project (staging first if one exists, otherwise directly to `oamczuibcgjqmjxqntsn` since it is additive and does not touch existing tables).
2. Deploy this branch to a Vercel Preview and manually verify the click-through in §8.
3. Get product-owner confirmation before merging to `main` (per the module's own rule: "Không merge hoặc push main nếu chưa có xác nhận").
4. Rollback path: this is purely additive — reverting the branch removes the new routes/UI; the 21 new tables can be left in place (unused) or dropped with `drop table if exists ... cascade` in a follow-up migration if ever needed. No existing table, RLS policy, or route was modified in a way that requires a rollback migration.
