# H2O Coach OS V1 — Production Audit

Date: 2026-08-14
Source package: `v5/39-H2OBOOK_H2O_COACH_OS_V1` (all files read in full before this audit).
Next free migration number: **0057** (latest applied is `0056_h2obook_learning_journey_intelligence_v1.sql`).

## 1. Canonical tables/services to reuse (confirmed by reading the real code, not the reference)

| Reference concept | Real table/service | Notes |
|---|---|---|
| Stage | `career_stages` (id, organization_id, slug, title, position, status, index_label…) | Already the real source of truth used by every prior folder this session. Coach runtime must read this, never hard-code Stage 1–6. |
| Journey mission | `learning_journey_missions`, `learning_journey_blueprints`/`_versions`, outcomes/milestones (migration 0050) | Untouched. Coach sits on top; does not replace Mission/Outcome identity or `root_mission_id`. |
| Mission progress/state | `student_mission_states`, `student_learning_actions` (migration 0050) | Untouched — canonical completion resolver (`maybeMarkResultAchieved`, `lib/learn-outcome/student.ts:217`, private/unexported) stays the only place a Mission is marked complete. Coach must call the existing service functions (`verifyMissionEvidence`/etc.), never re-implement completion logic. |
| Mission Workspace structured fields ("Hiểu nhiệm vụ" blocks) | `learning_mission_workspace_configs` + `student_mission_workspace_values` (migration 0052, `lib/mission-workspace/service.ts`) | **Not the same thing as Learner Memory.** These are per-(student, journey_version, mission, block_id) form values scoped to one Mission's workspace UI — there is no namespace/cross-mission key (`career.direction`) and no confirm/reject provenance. Cannot serve as Learner Memory without changing its shape/meaning, so it stays as-is and Coach reads from it only as one more "known context" input, same as it already feeds `getSmartJourneyReadModel`. |
| Skill practice evidence | `learning_skill_evidence` (migration 0028) | Untouched, unrelated to Coach memory (skill mastery, not profile facts). |
| Daily Log / Learning Memory (90-day) | `learner_experiences` (migration 0026, generalized 0056 — see `docs/H2O_LEARNING_JOURNEY_AUDIT.md`) | Untouched. A different memory concern (daily practice history) from Coach's structured profile-fact memory (`career.direction` etc.) — not merged. |
| AI provider | `lib/brain/ai.ts` + `lib/brain/providers/gemini.ts` | Real, working pattern: server-only Gemini REST call with a JSON `responseSchema`, gated by `GEMINI_API_KEY`, graceful no-op when unconfigured (`isGeminiConfigured()`/`describeAi()`). **Not configured in this environment** (`GEMINI_API_KEY` absent from `.env.local`) — any AI/Hybrid Coach mode built this pass cannot be live-verified here; it will report "not configured" and behave exactly like every other Gemini-backed feature in this deployment today. Reused as the provider pattern for Coach's candidate-extraction adapter — not a new SDK, not a new key, not a second provider abstraction. |
| Cohorts/classes | `classes` (migration 0002), `class_progress_cells` (migration 0014) | Real, exists for a different feature (teacher class rosters/progress cells). Rollout Phase 2 ("cohort-based/percentage rollout") is explicitly optional in the source prompt — not built this pass; noted as already-available infrastructure if ever needed. |
| Entitlements/roles | `public.member_role` enum (`owner,admin,designer,partner,teacher,student` — no `super_admin`), `has_org_role(org_id, role[])`, `is_org_member(org_id)` (migration 0001) | Reused verbatim for every new RLS policy below. |
| Chat/conversation history | **None found.** Grepped every migration for a message/conversation/chat table — none exists (a false-positive match was `bulk_generation_items.error_message`, not a chat table). | Genuinely new (see §2). |

## 2. What's genuinely missing (5 new tables, additive, migration 0057)

Nothing existing can serve these without changing its meaning for existing callers, so:

1. **`coach_stage_profiles`** + **`coach_stage_profile_versions`** — versioned per-Stage Coach config (role/tone, knowledge scope, memory schema, provider mode). Mirrors the exact blueprint/version/`current_published_version_id` pattern `learning_journey_blueprints`/`learning_journey_versions` already uses (migration 0050) — same draft → clone → edit → publish → rollback shape the Journey Admin Builder already ships, not a new versioning idea.
2. **`coach_mission_configs`** — one row per (profile version, mission): objective, required fields, question rules, tool bindings, result template. Scoped to a specific published/draft profile version, same relationship shape as `learning_mission_workspace_configs` has to a journey version.
3. **`learner_memory_values`** — the actual "Learner Memory": `(organization_id, learner_id, field_key, namespace, value jsonb, status: proposed/confirmed/rejected, confidence, source_mission_id, source_message_id, updated_at)`. Confirmed genuinely new in §1 — no existing table is keyed by a stable cross-mission field name with confirm/reject provenance.
4. **`coach_conversations`** — one row per (organization_id, learner_id, mission_id) holding the message history as a bounded `jsonb` array, not one row per message. Avoids row explosion and matches the prompt's own performance guidance ("không load toàn bộ chat history mỗi request") more naturally than a message-per-row table; canonical memory (`learner_memory_values`) stays the source of truth regardless of how much of the conversation is later trimmed/archived.

No `coach_memory_candidates` table: "proposed" is just a `status` value on `learner_memory_values` (matches the reference `types.ts`'s own `MemoryValueStatus = "proposed"|"confirmed"|"rejected"` — one table, not two).

## 3. Reference tables NOT created

- `coach_memory_candidates` — folded into `learner_memory_values.status` (see above).
- Any new `media_assets`/message-attachment table — file/photo attachments in Coach chat reuse the existing `assets` pipeline (`lib/assets/asset-client.ts`), exactly like Daily Log/Mission Evidence already do.
- No new role enum, no `super_admin` — `public.member_role` reused as-is.

## 4. Routes/components — keep vs. new

- **Keep, unchanged**: the 4-tab Mission Workspace (`components/student/mission-workspace/mission-workspace-client.tsx` and its tabs) stays as the backend workflow and the fallback UI when Coach is off. Nothing about Readiness/Completion, evidence, or the completion resolver is touched.
- **New, additive, feature-flagged**: `H2O Coach Workspace` mounts *inside* the same Mission route (`/student/missions/[missionId]`) as an alternative view gated by a flag + a per-Stage published Coach profile — not a new top-level route, so back-navigation/resource-click context stays inside the Mission the source prompt requires.
- **New**: `/academy-admin/coach-builder` (owner/admin only, mirrors the existing Academy Control Center admin surface).

## 5. Scope checkpoint before writing code

Everything above is resolvable from the audit alone. One real product-scope question remains, raised directly to the user next: how much of **AI/Hybrid mode** to build this pass, given `GEMINI_API_KEY` is not configured here and cannot be live-verified. Offline mode (deterministic rule engine) is unaffected either way and is being built as real, working, testable code per the source prompt's explicit "Offline mode phải có giá trị thật" requirement.
