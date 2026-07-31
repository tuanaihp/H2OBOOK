# H2OBOOK System Governance & Operations V2 — Integration Report

- Branch: `feature/system-governance-operations-v2`
- Backup tag: `h2obook-before-system-governance-operations-v2` (on `main`, pre-integration)
- Baseline: `main` @ `9ddc036` (v5 folder 6 of 6; independent branch, not stacked on modules 1/3/4/5)
- Module source: `H2OBOOK-SYSTEM-GOVERNANCE-OPERATIONS-V2-UNIFIED-MODULE`
- Package version bumped: `4.17.0` → `4.21.0`

## Confirmation required by the module's own prompt

**"V1 was not integrated in parallel":** the module's `README.md`/prompt states it "đã bao gồm và
thay thế toàn bộ nội dung của bản V1" and forbids integrating a V1 alongside it. No
`H2OBOOK-SYSTEM-GOVERNANCE-*-V1-*` module exists in this v5 batch (folders 1–6 audited; only this
V2 module covers System/Operations) — there was nothing to avoid double-integrating.

**A real, separate "Operations V1" already exists on `main`, and it was not modified.** Earlier in
this session (before this v5 batch), the `H2OBOOK-OPERATIONS-EXPANSION-FOUNDATION-MODULE` was
integrated and merged to `main` (commit `9ddc036`) — it implements the *real*, production
`/operations` route and its 8 sub-routes with `requireCurrentUser()` + role guards
(`app/operations/layout.tsx`, `lib/operations/role-bridge.ts`, `lib/operations/permissions.ts`),
already live behind `NEXT_PUBLIC_OPERATIONS_CENTER_V1`. The current module's own prompt
anticipates this exact scenario (Phase 1 explicitly says to audit "Operations Expansion
Foundation nếu đã được tích hợp"). This integration **did not touch, replace, or duplicate** that
existing implementation: `/operations/**` real routes, `app/operations/layout.tsx`,
`lib/operations/*`, and the workspace sidebar's Operations Center link are all untouched. This
module only adds an isolated new preview surface
(`/system-governance-ops-v2-preview/[surface]`) alongside it. Whether this V2 module's UI
eventually *replaces* the already-live Operations Foundation routes is a decision for a future
Phase 6 cutover pass, not made here — see Deferred production wiring below.

**Not merged into `main` in this pass** — pushed as a feature branch only, per instruction.

## Scope

A single dynamic preview route unifying UI, data contract and event contract for the 19
Personal/Governance/Operations surfaces: account, admin, assist-control, cloud-sync, enterprise,
integrations, offline, security, settings, smart-settings (Personal & Governance — 10 surfaces),
plus operations, operations-admissions, operations-approvals, operations-automation-center,
operations-import-center, operations-notifications, operations-product-config, operations-support,
operations-system-health (Operations Center — 9 surfaces). Per the module's own 6-phase plan, this
pass covers **Phase 1–2 (audit, preview) only**; Phase 3 (System Governance adapters: real
Supabase Auth account/session, real health/queue/audit data, encrypted API-key/webhook secrets,
redacted security screens), Phase 4 (Operations Center adapters: server-side aggregation,
admissions stage-change with optimistic concurrency, approval permission guards, sandboxed
automation runs, transactional import commit/rollback, consent-aware notifications, versioned
product config, SLA-tracked support tickets), and Phase 6 (production route cutover) are
**explicitly deferred** — matching the phased approach used for Creative Publishing Operations V1,
Academic & Teaching Operations V2, and Business Commerce & Growth Operations V1 earlier in this
batch. No existing production route (`/account`, `/admin`, `/security`, `/operations`, etc.) was
changed.

## Files added

`app/system-governance-ops-v2-preview/[surface]/page.tsx`, `components/system-governance-ops-v2/*`
(`index.ts`, `operations-shared.tsx`, `system-shared.tsx`, `system-governance-ops-v2.module.css`,
`system-governance-preview.tsx`, and 19 surface components under `pages/`),
`lib/system-governance-ops-v2/*` (`data.ts`, `events.ts`, `feature.ts`, `registry.ts`, `types.ts`),
`scripts/validate-system-governance-operations-v2.mjs`,
`tests/unit/system-governance-operations-v2.test.ts`. Module README kept for reference under
`docs/v5-modules/system-governance-operations-v2/`; its own `CLAUDE-INTEGRATION-PROMPT.md` copy
was not kept (same `=====`-as-merge-marker false positive documented in the module 1/3/4/5
reports).

## Files merged

- `.env.example` — appended `NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2=false` and
  `NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2_PREVIEW=true`, exactly as specified.
- `package.json` — added `validate:system-governance-operations-v2` script; version bump. No new
  dependency — the module has zero repo cross-imports at all (self-contained demo data, like
  Business Commerce & Growth Ops V1), the module needing the least integration surface of the six.
- `app/layout.tsx`, `middleware.ts`, `app/globals.css`, `pnpm-lock.yaml` — **not touched**, per the
  prompt's explicit "Không ghi đè... một cách mù quáng" list.

## Bug found and fixed — repo-wide infrastructure, same class as module 5's fix

This branch was cut independently from `main` (not stacked on the Business Commerce & Growth Ops
V1 branch), so it did not inherit that branch's version-regex widening. Bumping this branch's
`package.json` to `4.21.0` reproduced the exact same failure documented in the Business Commerce
report: several validator scripts gate on a version regex that only accepts minor versions 1–19.
Re-applied the identical fix to the same 8 files on this branch:
`scripts/validate-source.mjs`, `scripts/validate-v4.mjs`, `scripts/smoke-test.mjs`
(`[1-9]|1[0-9]` → `[1-9]\d*`), `scripts/validate-professional.mjs`,
`scripts/validate-editor-412.mjs` (`1[2-9]` → `1[2-9]|[2-9]\d+`), and
`scripts/validate-input-phase5.mjs`/`-phase6.mjs`/`-phase7.mjs` (`1[4-9]` → `1[4-9]|[2-9]\d+`).
Re-verified `pnpm validate` passes after the fix. **Whichever of these two branches (this one, or
`feature/business-commerce-growth-ops-v1`) merges to `main` second will re-introduce the identical
diff on these 8 files — the merge should apply cleanly since both branches made the exact same
textual change, but this is worth flagging explicitly before that merge.**

No bug was found inside the module's own source — no inline `.filter()`/`.map()` Zustand selector,
no `use*`-named non-hook handler, no mixed-type array literal (the three defect classes found in
Creative Publishing Operations V1). `pnpm typecheck` and `pnpm build` passed against the module's
own files unmodified.

## Route preview verification

Live-verified with Playwright against a production build (`pnpm build && pnpm start`), all 19
routes, three viewports each (1440×900 desktop, 768×1024 tablet, 390×844 mobile), plus a
secret-leak scan of each rendered page's visible text for common raw-secret patterns
(`sk_live`, `whsec_`, a `SUPABASE_SERVICE_ROLE_KEY=<value>` pattern, `AWS_SECRET`):

19/19 surfaces — HTTP 200, 0 console errors, no desktop/tablet/mobile horizontal overflow, no
secret pattern found in rendered output. A static `git grep` for the same patterns plus a raw
service-role-key assignment pattern across the module's own `lib/`/`components/` source also found
nothing. This is consistent with the module shipping only local demo/fallback data in this pass —
there is no real secret anywhere in the pipeline yet for it to leak.

## Adapter mapping (recorded for the deferred Phase 3/4, not implemented)

| V2 contract | Repo source of truth | Adapter needed |
|---|---|---|
| Account profile/session | Supabase Auth (`lib/auth/current-user.ts`) | Not wired — Phase 3 |
| Production Admin / System Health | Health endpoint (`/api/health`, `/api/readiness`) | Not wired — Phase 3 |
| Security controls | RLS policies / security reports | Not wired — Phase 3 |
| Cloud Sync / Offline / Backup | Existing backup/snapshot repository | Not wired — Phase 3 |
| AI Policy | Existing optional-assist config (`lib/runtime-config.ts` capability flags) | Not wired — Phase 3 |
| Enterprise API keys/webhooks | API-key/webhook repository (hash-stored, one-time raw display) | Not wired — Phase 3 |
| Operations Home aggregate | Admissions/support/approval/automation/notification/health summary adapter | Not wired — Phase 4 |
| Admissions | Existing academy applications table (`academy_applications`, from the V4.16 revenue-loop work on a separate branch) | Not wired — Phase 4 |
| Approvals | Existing `approval_requests` table (from the Operations Expansion Foundation, already on `main`) | Not wired — Phase 4 |
| Automation | Domain event bus / webhook delivery | Not wired — Phase 4 |
| Import Center | Unified Input/Import Engine (4.13.7) | Not wired — Phase 4 |
| Notifications | Email/transactional provider (`lib/email/*`, from V4.16, separate branch) | Not wired — Phase 4 |
| Product Config | New versioned config repository | Does not exist yet — Phase 4 |
| Support | Existing `support_tickets` table (Operations Expansion Foundation, already on `main`) | Not wired — Phase 4 |

Two of these (`approval_requests`, `support_tickets`) already have real tables and RLS on `main`
from the earlier Operations Expansion Foundation integration — a future Phase 4 pass should reuse
those tables and their `owner/admin`-scoped policies rather than create parallel ones.

## Role mapping (recorded, not enforced — moot until real routes exist)

The module's own registry (`lib/system-governance-ops-v2/registry.ts`) declares
`requiredRoles` per surface, matching the prompt's Phase 5 table (e.g. `/enterprise` and `/admin`
→ owner/admin/platform_admin; `/operations/admissions` → owner/admin/admissions;
`/operations/approvals` → owner/admin/content_manager/teacher). As documented in the Operations
Expansion Foundation and Business Commerce reports, `admissions`, `support`, `content_manager`,
`operations`, and `platform_admin` are **not** in the repository's real `member_role` enum
(`owner, admin, designer, partner, teacher, student` — `supabase/migrations/0001_h2obook_core.sql`)
— this is the same, now-repeatedly-documented gap across three modules in this batch. A future
cutover pass should reuse the existing `lib/operations/role-bridge.ts` pattern rather than
re-invent a fourth version of the same bridge.

## Validation results

| Command | Result |
|---|---|
| `pnpm validate:system-governance-operations-v2` | Pass — 19 surfaces, 19 pages |
| `pnpm validate` | Pass — 51 core files (after re-applying the version-regex fix) |
| `pnpm validate:imports` | Pass — 453 source files |
| `pnpm typecheck` | Pass, 0 errors, no module-source changes needed |
| `pnpm test` | Pass — 17 files, 57 tests (incl. the module's own `system-governance-operations-v2.test.ts`, 4 tests) |
| `pnpm build` | Pass — `/system-governance-ops-v2-preview/[surface]` builds as a dynamic (non-SSG) route |
| Live verification (Playwright, `pnpm start`, all 19 surfaces × 3 viewports + secret scan) | 19/19 pass — see table above |
| Static secret scan (`git grep` over module source) | No matches for `sk_live`/`whsec_`/service-role-key-assignment/`AWS_SECRET` patterns |

`pnpm test:sql` was not run — no migration in this module (the prompt explicitly forbids running
one in this pass). `pnpm test:e2e` (full Playwright suite) was not re-run beyond the targeted
checks above, consistent with the approach used for the other v5 modules in this batch.

## Known limitations

- No production route was switched (Phase 3/4/6 of the module's own plan) — intentional, matching
  the pattern set by modules 3, 4, and 5 in this batch, and doubly warranted here since this is
  the most security-sensitive module (API keys, webhook secrets, backup/restore, audit).
- The relationship between this module and the already-live Operations Expansion Foundation
  (`/operations/**` on `main`) is documented but not resolved — a future pass must decide whether
  V2's UI replaces the Foundation's pages, or whether the Foundation's already-working real-data
  wiring (admissions/support/approvals with real tables and RLS) becomes the adapter layer V2's
  UI calls into. Recorded as an open decision, not decided unilaterally here.
- `admissions`/`support`/`content_manager`/`operations`/`platform_admin` roles don't exist in the
  database contract yet (see Role mapping above).

## Rollback

`NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2=false` (already the shipped default) and
`NEXT_PUBLIC_SYSTEM_GOVERNANCE_OPERATIONS_V2_PREVIEW=false` fully hide this module; since no
production route was touched, there is nothing else to roll back. The version-regex fixes are
independent, additive corrections to shared validator scripts. Backup tag
`h2obook-before-system-governance-operations-v2` marks `main` exactly as it was before this branch.

## Final status

**READY_FOR_VERCEL_PREVIEW**
