# H2OBOOK Academic & Teaching Operations V2 — Integration Report

- Branch: `feature/academic-teaching-ops-v2`
- Backup tag: `h2obook-before-academic-teaching-ops-v2` (on `main`, pre-integration)
- Baseline: `main` @ `9ddc036` (v5 folder 4 of 6; independent branch, not stacked on modules 1/3)
- Module source: `H2OBOOK-ACADEMIC-OPERATIONS-V2-UNIFIED-MODULE`
- Package version bumped: `4.17.0` → `4.19.0`
- **Module 2 (`H2OBOOK-ACADEMIC-OPERATIONS-V1-UNIFIED-MODULE`) was not integrated.** Its own README
  and this module's prompt both say V2 supersedes V1 and "Không tích hợp Academic Operations V1
  riêng nữa" (do not integrate V1 separately) — integrating both would have produced duplicate,
  conflicting route/component sets.

## Scope

A single unified preview surface for the 14 academic/teaching admin pages: dashboard, learn,
knowledge, library, assignments, classes, quizzes, study, class-view, students, reviews,
collaboration, automations, processing — the last six (automations, class-view, collaboration,
processing, reviews, students) are V2's addition over V1. Per this module's own prompt
("Không thay production routes trước khi 14 preview routes đạt"), production routes are only
switched over after all 14 preview routes pass — this integration completes exactly that gate:
**all 14 preview routes are wired and verified; no existing production route (`/dashboard`,
`/learn`, `/students`, etc.) was changed.** See Deferred production wiring below for what the
next step requires.

## Files added

`components/academic-ops-v2/*` (`index.ts`, `shared.tsx`, `academic-ops.module.css`, and 14
surface components: `dashboard.tsx`, `learn.tsx`, `knowledge.tsx`, `library.tsx`,
`assignments.tsx`, `classes.tsx`, `quizzes.tsx`, `study.tsx`, `class-view.tsx`, `students.tsx`,
`reviews.tsx`, `collaboration.tsx`, `automations.tsx`, `processing.tsx`),
`lib/academic-ops-v2/*` (`analytics.ts`, `feature.ts`, `selectors.ts`, `teaching-data.ts`,
`types.ts`), `app/academic-ops-v2-preview/*/page.tsx` (14 routes),
`scripts/validate-academic-ops-v2.mjs`, `tests/unit/academic-ops-v2.test.ts`. Module README kept
for reference under `docs/v5-modules/academic-teaching-ops-v2/`; its own
`CLAUDE-INTEGRATION-PROMPT.md` copy was not kept (same `=====`-as-merge-marker false positive
documented in the module 1 and module 3 reports).

## Files merged

- `.env.example` — appended `NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2=false` and
  `NEXT_PUBLIC_ACADEMIC_OPERATIONS_PREVIEW=true`, exactly as specified.
- `package.json` — added `validate:academic-ops-v2` script; version bump only. No new dependency
  — the module uses only `lucide-react`, `next/link`, existing `@/components/ui/modal` and
  `@/store/app-store`/`@/types/domain`, all already present.

No shared file was touched beyond these two — `AppShell`, `useAppStore`, `useEditorStore`, auth/
middleware, Supabase schema/RLS, R2, the Editor engine, Unified Input, the publishing worker,
Public Academy V5, and Creative Publishing Operations V1 were not modified, per the prompt's
explicit "Không được thay đổi" list.

## Bugs found

None. Unlike modules 1 and 3, this module's `useAppStore` selectors all read raw state slices
(no inline `.filter()`/`.map()` selectors, which caused an infinite-render bug in module 3), no
handler was misnamed with a `use*` prefix (which broke module 3's production build via
`react-hooks/rules-of-hooks`), and no mixed-type array literal caused a type-widening error (which
affected module 3's `editor-studio-v1.tsx`). `pnpm typecheck` and `pnpm build` both passed on the
first attempt with zero changes to the module's own source.

## Route preview verification

Live-verified with Playwright against a production build (`pnpm build && pnpm start`), all 14
routes, three viewports each (1440×900 desktop, 768×1024 tablet, 390×844 mobile):

| Surface | Status | Console errors | Desktop overflow | Tablet overflow | Mobile overflow |
|---|---|---|---|---|---|
| dashboard | 200 | 0 | no | no | no |
| learn | 200 | 0 | no | no | no |
| knowledge | 200 | 0 | no | no | no |
| library | 200 | 0 | no | no | no |
| assignments | 200 | 0 | no | no | no |
| classes | 200 | 0 | no | no | no |
| quizzes | 200 | 0 | no | no | no |
| study | 200 | 0 | no | no | no |
| class-view | 200 | 0 | no | no | no |
| students | 200 | 0 | no | no | no |
| reviews | 200 | 0 | no | no | no |
| collaboration | 200 | 0 | no | no | no |
| automations | 200 | 0 | no | no | no |
| processing | 200 | 0 | no | no | no |

14/14 pass with zero hydration errors, zero console errors, and no horizontal overflow at any
breakpoint — no CSS or React fixes were needed for this module (contrast with module 3, where the
same class of checks found and required fixing a CSS Grid blowout and a React error #185 loop).

## Production route mapping (deferred, not implemented)

The prompt's mapping (`/dashboard` → `AcademicDashboardV2`, `/learn` → `AcademicLearnV2`, … all 14)
was **not** applied in this pass. Reasoning, consistent with how module 3 (Creative Publishing
Ops V1) was scoped: `NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2` defaults to `false` in the module's own
`.env.example.fragment`, and the prompt's own gate ("Không thay production routes trước khi 14
preview routes đạt") is satisfied by this pass, not exceeded by it. Switching over 14 real admin
routes — each currently backed by its own existing data wiring (`/students` reads real enrollment
data, `/reviews` reads real approval requests, etc.) — is a second, larger pass that needs, per
the prompt itself, real role-scoped adapters (teacher sees only assigned classes; content_manager
sees reviews/collaboration/processing only; admissions sees student records only within
provisioning scope) that don't exist yet for this module and shouldn't be faked with the demo
`teaching-data.ts` fallback standing in as if it were production data. Attempting that switch in
the same pass as first-time preview verification would risk exactly the kind of "UI screen mistaken
for an end-to-end engine" claim this project's rules ask to avoid.

## Data and adapters

`lib/academic-ops-v2/teaching-data.ts` is explicitly fallback/demo data for preview, not claimed
as production. Per the module's own adapter notes (not implemented in this UI-integration pass,
listed here for the next pass): Automations → existing domain events/webhook delivery; Class View
→ existing classes/students/assignments/submissions contract; Collaboration → existing presence/
comments adapter (no realtime claimed without a provider); Processing Queue → existing document/
publishing worker jobs; Reviews → existing approval requests/audit log; Students → existing
profile/organization-membership/enrollment/entitlement contract. No migration was added or run,
per the prompt's explicit prohibition for this pass.

## Role checks

Not implemented in this pass — moot until the production routes above are wired, since the
preview routes carry no session/role data by design (matches the precedent set by every other
preview-only surface in this batch: Operations Foundation's sub-routes, Public Academy V5's
preview hub, Creative Publishing Ops V1's preview). The prompt's role table (owner/admin: full
access; teacher: classes/class-view/assignments/reviews/collaboration/students-by-assigned-class;
content_manager: reviews/collaboration/processing; admissions: students within provisioning scope;
student: no access to any of these routes) is recorded here as the contract the next pass must
implement against the real `member_role` enum — the same enum already extended with a role bridge
for the Operations Expansion Foundation (`lib/operations/role-bridge.ts`, on a separate branch),
which the next pass should reuse rather than re-invent.

## Validation results

| Command | Result |
|---|---|
| `node scripts/validate-academic-ops-v2.mjs` | Pass — 36 files, 14 preview routes |
| `pnpm validate` | Pass — 51 core files |
| `pnpm validate:imports` | Pass — 459 source files |
| `pnpm typecheck` | Pass, 0 errors, no source changes needed |
| `pnpm test` | Pass — 17 files, 55 tests (incl. the module's own `academic-ops-v2.test.ts`, 2 tests) |
| `pnpm build` | Pass — all 14 `/academic-ops-v2-preview/*` routes statically prerendered |
| Live verification (Playwright, `pnpm start`, all 14 surfaces × 3 viewports) | 14/14 pass — see table above |

`pnpm test:sql` was not run — no migration in this module. `pnpm test:e2e` (full Playwright suite)
was not re-run beyond the targeted checks above, consistent with the approach used for the other
v5 modules in this batch.

## Known limitations

- No production route was switched (see "Production route mapping" above) — this is the explicit,
  intentional stopping point for this pass, not an oversight.
- Role-scoped access (teacher/content_manager/admissions boundaries) is documented as a contract
  but not implemented, since it only matters once real routes exist.
- `teaching-data.ts` is demo data; Supabase-backed queries for classes/students/assignments/
  reviews/automations were not exercised against a real database in this session (no Supabase
  project configured — demo mode only, consistent with every other module in this batch).

## Rollback

`NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2=false` (already the shipped default) and
`NEXT_PUBLIC_ACADEMIC_OPERATIONS_PREVIEW=false` fully hide this module; since no production route
was touched, there is nothing else to roll back. Backup tag
`h2obook-before-academic-teaching-ops-v2` marks `main` exactly as it was before this branch.

## Final status

**READY_FOR_VERCEL_PREVIEW**
