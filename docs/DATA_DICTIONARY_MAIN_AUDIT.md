# H2OBOOK Data Dictionary — Main Repository Audit

Source module: `v5/17-h2obook-data-dictionary-v1`
Scope of this document: **audit and reference only.** Per explicit user decision, this pass does
**not** implement the source module's 14-table Resource Registry / dual-write / reconciliation
system. No table was dropped, renamed, or altered; no RLS policy changed; no UI changed; no
migration was written. This document is the deliverable.

## 0. Why a registry was not built

The source module's Resource Registry (`ResourceRegistryService`, `ResourceFileService`,
`ResourceVersionService`, dual-write, legacy-alias adapters) exists to solve **schema
fragmentation** — the case where the same business entity ended up in two or more competing
tables over time (its own worked example: `academy_courses` vs `learning_courses`,
`academy_entitlements` vs `learning_user_entitlements` vs `h2o_course_purchases`, `h2o_audit_events`
vs `learning_audit_logs`).

**None of the module's example conflict pairs exist in this repository** (grepped every migration
file — zero matches for `learning_content_items`, `learning_courses`, `learning_course_lessons`,
`learning_roadmaps`, `h2o_learning_programs`, `learning_user_entitlements`, `h2o_course_purchases`,
`learning_audit_logs`). Across 31 migrations and roughly 15 feature modules integrated into this
repo (see §5 for the one real near-duplicate found), each domain already has exactly one clear
table that every read and write path actually uses. Building a full parallel registry on top of an
already-coherent schema would itself become the "second engine" every module's own integration
rules (this one included, §1.2–1.4) explicitly forbid. The genuinely useful part of the source
module — a clear, explicit map of source-of-truth, ownership, storage and gaps — is this document.

## 1. Method

Read directly from `supabase/migrations/0001_h2obook_core.sql` through
`0031_h2obook_academy_control_center_v1.sql` (31 files, the actual, currently-applied schema —
not the reference module's assumed generic SaaS schema), cross-checked against the server code
that actually reads/writes each table (`lib/*`, `app/api/**/route.ts`). Ownership/RLS classification
is read from each table's own `create policy` statements, not inferred from naming.

## 2. Source-of-truth table per domain

| Domain | Entity | Source-of-truth table | Migration |
|---|---|---|---|
| Identity/Workspace | User profile | `profiles` | 0001 |
| Identity/Workspace | Workspace | `organizations` | 0001 |
| Identity/Workspace | Role/membership | `organization_members` | 0001 |
| Create | Book | `books` | 0001 |
| Create | Book version snapshot | `book_versions` | 0001 |
| Create | Page | `book_pages` | 0001 |
| Create | Page element | `page_elements` | 0001 |
| Create | File/media object | `assets` | 0001 |
| Create | Template | `templates` | 0001 |
| Create | Book clone (franchise) | `book_clones` | 0001 |
| Create | Publication (public/sold copy) | `publications` | 0001 |
| Create | Semantic import result | `book_documents` / `content_nodes` | 0008 |
| Create | Import session (Unified Input Gateway) | `input_sessions` | 0021 |
| Create | Learner-authored outcome project | `create_outcome_projects` | 0027 |
| Learn (legacy classroom) | Class | `classes` | 0002 |
| Learn (legacy classroom) | Class membership | `class_members` | 0002 |
| Learn (legacy classroom) | Assignment | `assignments` | 0002 |
| Learn (legacy classroom) | Submission | `assignment_submissions` | 0002 |
| Learn (legacy classroom) | Quiz | `quizzes` / `quiz_questions` / `quiz_attempts` | 0002 |
| Learn (Academy self-serve) | Course | `academy_courses` | 0024 |
| Learn (Academy self-serve) | Module | `academy_course_modules` | 0024 |
| Learn (Academy self-serve) | Lesson | `academy_course_lessons` | 0024 |
| Learn (Academy self-serve) | Lesson progress | `academy_lesson_progress` | 0024 |
| Learn (Academy self-serve) | Skill progress (per course) | `academy_skill_progress` | 0024 |
| Learn (H2O Brain) | Knowledge Space (rich lesson) | `knowledge_spaces` / `knowledge_space_versions` | 0026 |
| Learn (H2O Brain) | Lesson block content | `learning_blocks` | 0026 |
| Learn (H2O Brain) | Assignment (Brain-linked) | `assignment_definitions` | 0026 |
| Learn (H2O Brain) | Submission (Brain-linked) | `brain_assignment_submissions` | 0026 |
| Learn (H2O Brain) | Space completion progress | `knowledge_space_progress` / `block_progress` | 0026 |
| Learn (H2O Brain) | Rubric | `rubrics` / `rubric_criteria` | 0026 |
| Learn | Flashcard | `flashcards` | 0006 |
| Learn | Cross-source skill evidence ledger | `learning_skill_evidence` | 0028 |
| Teach | Private instructor note/intervention | `teach_student_interventions` | 0029 |
| Teach | Content review/approval | `review_requests` / `review_comments` | 0003 |
| Business | Product (sellable) | `products` | 0002 |
| Business | Order | `orders` / `order_items` | 0002 |
| Business | Membership subscription | `memberships` | 0002 |
| Business | Access grant | `entitlements` | 0001 |
| Business | Learner's own CRM pipeline | `business_opportunities` | 0030 |
| Business | Learner's own goal | `business_goals` | 0030 |
| Business | Non-content feature grant (text-keyed) | `business_feature_grants` | 0030 |
| Operations | Admissions lead | `admission_leads` | 0025 |
| Operations | Support ticket | `support_tickets` | 0025 |
| Operations | Approval queue item | `approval_requests` | 0025 |
| Operations | Legacy data import job | `operations_import_jobs` | 0025 |
| System | Row-level change history | `domain_events` | 0007 |
| System | App-driven audit action | `audit_logs` | 0001 |
| System | Security-relevant event | `security_events` | 0004 |
| System | Payment webhook receipt | `payment_events` | 0004 |
| System | Background job (document worker) | `document_jobs` / `document_job_events` | 0004 |
| System | Import/reconstruction session | `input_sessions` / `input_session_events` | 0021 |

## 3. Input → Process → Output, by tab

### Create
- **Input**: file upload (DOCX/PDF/PNG/JPEG/HTML/Markdown/TXT/URL/multi-image/ZIP) via `/input`
  (Unified Input Gateway) or the legacy inline importer in the editor; manual authoring in the
  Compose/Design editor.
- **Process**: `packages/input-core/src/orchestrator.ts` normalizes every format into one
  `ImportDocument`/`BookDocument` shape; security validation (magic bytes, size, ZIP safety) runs
  before any R2 write (`lib/security/uploads.ts`); the editor is local-first (Zustand +
  IndexedDB via `lib/assets/local-asset-store.ts`) and syncs to Supabase through
  `app/api/books/cloud-save` / `cloud-load`, matched by `client_key`.
- **Output**: `books` → `book_pages` → `page_elements` (+ `assets` for any uploaded media,
  `book_versions` for published snapshots). Learner-side outcome authoring (Create Outcome Studio)
  writes to `create_outcome_projects` instead — a separate, owner-scoped table, not `books`
  (deliberately: `books`' own `save_book_document()` RPC is staff-only).

### Learn
- **Input**: student lesson interaction (video watch, block completion, quiz attempt), instructor
  Knowledge Space authoring (`/instructor/brain-studio`), Academy course/lesson authoring
  (`/academy-admin/programs`).
- **Process**: two parallel, intentionally-separate progress mechanisms (not a conflict — see
  §5.1): `academy_lesson_progress`/`academy_skill_progress` for the self-serve Academy catalog,
  `block_progress`/`knowledge_space_progress` for H2O Brain Knowledge Spaces. `getSkillMastery()`
  (`lib/student/mastery.ts`) merges both plus `learning_skill_evidence` into one per-skill score —
  the one place these two systems are deliberately unified, at the read layer, not the storage
  layer.
- **Output**: progress rows above; `flashcards` (spaced repetition); `learning_results`
  (Knowledge Space outcome record); `learner_notes`/`journal_entries` (student-authored).

### Teach
- **Input**: instructor grading action (Feedback Studio, `/instructor/assessments`), risk-radar
  intervention note (`/instructor/students`), content review decision (`/reviews`).
- **Process**: grading writes directly to the *existing* submission row (`assignment_submissions.
  score/feedback` or `brain_assignment_submissions.score/instructor_feedback`) — there is no
  separate "grade" entity. Interventions are the one genuinely new Teach-domain concept
  (`teach_student_interventions`, module 12). Scope enforcement is class-based
  (`classes.teacher_id`/`class_members`), not a separate ACL table.
- **Output**: updated submission row; new `teach_student_interventions` row; on
  pass/portfolio-ready, a new `learning_skill_evidence` row (cross-links Teach → Learn).

### Business
- **Input**: real payment webhook (`app/api/payments/webhook/[provider]/route.ts`), admin manual
  grant (`/academy-admin/distribution`), student's own CRM pipeline entry
  (`/student/business/customers`).
- **Process**: `mark_order_paid()` (security-definer SQL function, 0002/0005) is the **single**
  place `entitlements`/`memberships` get created from a paid order — no code path outside it
  writes those tables directly. Manual grants go through the same `entitlements` table via the
  admin-only RLS policy added in 0031, with `reason`/`granted_by` for audit.
- **Output**: `orders`/`order_items` → `entitlements` (+ `memberships` for `product_type=
  'membership'`) → student-visible access. `business_opportunities`/`business_goals` are entirely
  separate, personal, owner-scoped data with no relationship to the commerce tables above (a
  student's own client list, not H2OBOOK's own commerce).

### Operations
- **Input**: public academy application form, support request, internal approval action.
- **Process**: `syncAdmissionLeadFromApplication()` (`lib/operations/lead-bridge.ts`) bridges
  `academy_applications` (Academy domain) into `admission_leads` (Operations CRM domain) — the one
  explicit, intentional cross-domain sync in the schema. The Operations Center UI itself
  (`/operations/*`, 9 pages) still reads from a client-side Zustand demo store, not these tables —
  a real, previously-documented gap (found during module 14's audit), not something this document
  introduces.
- **Output**: `admission_leads`, `support_tickets`, `approval_requests`.

### System
- **Input**: any table write matched by a `capture_domain_event()` trigger; any explicit
  `lib/domain/audit.ts` call; payment/security webhook receipt.
- **Process**: two independent mechanisms — automatic row-snapshot triggers (`domain_events`) and
  manual app-driven action logging (`audit_logs`) — see §5.2 for why this is a real duplicate-intent
  pair, not by design.
- **Output**: `domain_events`, `audit_logs`, `security_events`, `payment_events`.

## 4. Ownership classification

| Created by | Representative tables | How ownership is enforced |
|---|---|---|
| **Admin/Owner only** | `academy_courses`, `academy_course_modules`, `academy_course_lessons`, `products`, `templates`, `libraries` | RLS `has_org_role(org, ['owner','admin'])` (some, e.g. courses, also allow `'teacher'` — see §6.1) |
| **Teacher/Instructor** | `classes` (as `teacher_id`), `knowledge_spaces`, `brain_assignment_submissions.instructor_feedback`, `teach_student_interventions` | RLS scoped via `has_org_role(org, [...,'teacher'])` or `classes.teacher_id = auth.uid()` |
| **Student/Member** | `create_outcome_projects`, `business_opportunities`, `business_goals`, `learner_notes`, `journal_entries`, `flashcards`, `reader_notes`, `bookmarks` | RLS `owner_id = auth.uid()` / `user_id = auth.uid()` — strictly personal, no staff default-read except where explicitly added (e.g. `create_outcome_projects` staff read, 0027) |
| **System-generated (no human actor)** | `domain_events`, `analytics_events`, `input_session_events`, `academy_lesson_progress` (upserted by playback tracking, not typed by the student), `payment_events` | No direct client write path at all; server/trigger-only |

## 5. Duplicate/legacy tables and dual-source-of-truth risk

### 5.1 NOT a conflict (documented so it isn't "fixed" by mistake later)
`academy_lesson_progress`/`academy_skill_progress` (Academy self-serve courses) vs.
`block_progress`/`knowledge_space_progress` (H2O Brain Knowledge Spaces) look like duplicates by
name but track **two different content types** (`academy_course_lessons` vs `knowledge_spaces`) —
both are real, both are actively written, and `getSkillMastery()` already merges them correctly at
read time. Consolidating the storage layer would require merging two structurally different
content systems and is out of scope; the *read-layer* unification already in place is sufficient.

### 5.2 Real duplicate-intent pair: `audit_logs` vs `domain_events`
- `audit_logs` (0001): `action`/`resource_type`/`resource_id`/`metadata`, written explicitly by
  application code via `lib/domain/audit.ts`.
- `domain_events` (0007): `event_name`/`resource_type`/`resource_id`/`payload`, written
  automatically by the `capture_domain_event()` trigger, now attached to 6+ tables across modules
  8/10/12/13/15 (knowledge_spaces, create_outcome_projects, teach_student_interventions,
  business_goals/opportunities, entitlements).
- **Risk**: a future reader wanting "what happened to resource X" must check both tables and merge
  by `(resource_type, resource_id, timestamp)` — there is no single audit read path today.
- **Recommendation (not applied in this pass)**: standardize on `domain_events` (trigger-based,
  can't be forgotten by a future write path) for new work; treat `audit_logs` as legacy/frozen
  rather than adding new call sites to it. No existing row was touched.

### 5.3 Legacy vs current, same concept, different era (kept intentionally — see each module's own report)
- `assignment_submissions` (0002, classroom) vs `brain_assignment_submissions` (0026, Knowledge
  Space) — different assignment systems, not renamed to avoid the exact collision documented in
  module 8's own integration report (migration 0026's header comment).
- `reader_notes`/`bookmarks` (0001/0002, real tables, RLS-ready) vs. the Reader UI's actual
  `localStorage`-only persistence today (documented gap, module 16's integration report §5) — the
  table exists, the UI doesn't use it yet. Not a schema duplicate; a wiring gap.

### 5.4 No table was found that should be dropped or renamed
Every table inventoried in §2 has at least one real, current read or write path in application
code. This audit found no dead/orphaned table warranting removal.

## 6. Minimal additive gaps (recommendations only — none applied this pass)

### 6.1 `academy_courses`/`academy_course_modules`/`academy_course_lessons` RLS is broader than the app layer assumes
The "admin write" RLS policies (0024) grant write access to `owner`/`admin`/**and `teacher`**, but
`/academy-admin/*` (module 15) only exposes course authoring to `admin`/`owner` at the application
layer. This is documented, not a bug (module 15's own report §1/§5) — flagged here again as the
kind of "broader legacy RLS + narrower app layer" pattern that recurs across this schema (also true
for `classes`, `assignments`, `entitlements` — see each module's own report) and is worth a
dedicated pass if per-role RLS tightening is ever prioritized.

### 6.2 No version history for `assets`
`book_versions` (0001) already establishes the right pattern (`version_number`, `snapshot`,
`created_by`, `unique(parent, version_number)`) but `assets` has no equivalent — replacing a media
file overwrites the single row in place (`storage_key` is `unique`, so a true replace is actually a
new row + orphaning the old one, not an in-place update, but there is no explicit version chain
linking old → new). Relevant if a future Bulk Page Manager (module 16's deferred scope) needs
"replace image, keep page ID, keep history."

### 6.3 `entitlements.resource_id` cannot address text-keyed resources
Already solved once (module 13's `business_feature_grants`) for `BusinessFeature` slugs. The same
shape mismatch (`resource_id uuid not null` vs. a fixed text-slug vocabulary) will recur for any
future non-content entitlement (e.g. a named report, a support tier) — the established fix is a
small, purpose-built table like `business_feature_grants`, not a schema change to `entitlements`
itself.

### 6.4 No `owner_user_id`/`workspace_id` gaps found on any table in active use
Every table inventoried in §2 already carries `organization_id` (workspace scope) and, where
personal, a `user_id`/`owner_id`/`owner_user_id` column with matching RLS. No table was found
missing workspace or owner scoping that is actually reachable from a real read/write path.

### 6.5 Resource cross-references are ad hoc but consistent
There is no generic `resource_type`/`resource_id` join table linking e.g. a `create_outcome_project`
back to the `academy_course_lessons` row it was inspired by — instead each table adds its own
specific nullable FK when a real cross-domain link is needed (`create_outcome_projects.
source_lesson_id`, `create_outcome_projects.source_knowledge_space_id`,
`business_opportunities.source_payload` jsonb). This is deliberate (module 10/13's own reports) and
consistent across the schema; a generic relation table was considered and rejected by precedent,
not overlooked.

## 7. Storage location matrix

| Data kind | PostgreSQL (Supabase) | Cloudflare R2 | IndexedDB (client) |
|---|---|---|---|
| Book/page/element structure | `books`/`book_pages`/`page_elements` (synced) | — | Zustand + `lib/assets/local-asset-store.ts` (authoring draft, local-first source during editing) |
| Uploaded media (image/PDF/video reference) | `assets` (metadata: `storage_key`, `mime_type`, `size_bytes`, `checksum` in `metadata` jsonb) | actual file bytes, keyed by `assets.storage_key` | temporary object URL / IndexedDB blob cache during upload preview only |
| Course/lesson content | `academy_course_lessons.content` (jsonb), `knowledge_spaces`/`learning_blocks` | video files referenced by `video_url`/`video_playback_id` (Cloudflare Stream, not R2 object storage) | none |
| Student progress/notes/flashcards | `academy_lesson_progress`, `block_progress`, `flashcards`, `learner_notes` | — | Reader bookmarks/notes today (`localStorage`, not IndexedDB — see §5.3) |
| Import sessions (Unified Input Gateway) | `input_sessions`/`input_session_events` (session state, retry, recovery) | uploaded source file + generated assets | preview objects during the inspect/preview step, pre-commit |
| Commerce | `orders`/`entitlements`/`memberships` | receipts/invoices: not currently generated as files | — |
| Audit/events | `domain_events`/`audit_logs`/`security_events` | — | — |

## 8. Explicit non-actions in this pass

- No table dropped or renamed.
- No RLS policy changed.
- No dual-write introduced.
- No UI, route, sidebar or layout changed.
- No migration file created.
- The source module's 14-table Resource Registry, `ResourceRegistryService` and related services
  were not adopted — see §0 for why.
