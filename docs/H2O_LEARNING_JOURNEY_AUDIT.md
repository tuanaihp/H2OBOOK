# H2O Learning Journey Intelligence V1 — Production Audit

Date: 2026-08-14
Source package: `v5/38-h2obook_learning_intelligence_v1` (11 files, read in full before any code was written).

## 1. Goal vs constraint

The reference package asks for a "Learning Memory" layer: 90-day daily practice log (what was
practiced, real products used, photo/video evidence, skill being practiced, self score, instructor
score, time spent, recurring errors, feedback, next action) feeding an H2OBrain student-context
endpoint and Weekly / Day30 / Day60 / Day90 capability snapshots.

Hard constraints carried into this implementation (session-standing + user's explicit 2026-08-14
message):

- Do not rebuild Journey (Stage → Mission → Checkpoint → Progress → Unlock stays untouched).
- Do not change Stage/Mission IDs or unlock logic.
- Do not drop or rename any existing table or column.
- Do not break folder 36's already-shipped Daily Practice Journal UI/API.
- `evidenceCompletionGate` stays `false` in V1.
- Additive migration only; map to existing entities before inventing new tables.
- If a compatibility adapter is needed so old code keeps working, build one instead of a breaking
  rewrite.
- Check `learner_notes` for real production data before any migration; backfill safely if present.

## 2. Real architecture found (map, not the reference's assumed one)

| Reference concept | Real table found | Verdict |
|---|---|---|
| Daily practice log entry | `learner_experiences` (migration 0026) | **Reuse.** Already has `steps_taken`, `challenges`, `next_improvement`, `asset_ids[]`, `instructor_feedback`, `visibility`, `moderation_status` — closer to the reference's field list than `learner_notes`. Never used by any prior folder this session; zero real rows. |
| Simple journal note (what folder 36 actually built) | `learner_notes` (migration 0026, generalized 0053/0055) | Existing Daily Practice Journal (folder 36) wrote here. Zero real production rows (`resource_type='mission'` count = 0, confirmed via direct query 2026-08-14) — safe to redirect with no backfill. Table itself is **not** touched/dropped — it still serves the Reader's "Lưu vào Học & ghi nhớ" (`lib/curriculum/reader-context.ts`) and `/api/learning/notes`. |
| Skill practice evidence | `learning_skill_evidence` (migration 0028) | **Reuse as-is.** `skill_key` and `source_type` are plain `text`, not CHECK-constrained — new values need no migration. Existing writer: `lib/stage1-learning-os/skill-evidence.ts`'s `recordStage1SkillEvidence()` (`source_type='learning_journey_missions'`). New writer for Daily Log uses `source_type='learner_experiences'`, `source_id=<experience id>` — same convention, different source table. |
| Instructor feedback / score | `learner_experiences.instructor_feedback` | **Reuse.** Already exists as free text. RLS requires staff writes go through the admin client (`with check (user_id=auth.uid())` on the self-write policy blocks a teacher's own session) — same pattern already established by `recordStage1SkillEvidence` and `createNotification`. |
| Feature flags | reference proposes a DB-backed `learning_feature_flags` table | **Rejected.** Every prior folder this session (Stage1 Learning OS, Mission Workspace V2) uses a tiny local `enabled(value, fallback)` env-var helper per file (`process.env.NEXT_PUBLIC_*`). Adding a DB-backed flag system now would be a second, inconsistent flag mechanism for no real gain — kept the established pattern. |
| Weekly / Day30 / Day60 / Day90 capability snapshot | *(none)* | **Genuinely new** — no existing table stores a point-in-time capability assessment. One small additive table: `learning_capability_snapshots`. |

## 3. Skill taxonomy decision

`lib/student/experience.ts`'s `studentSkills` (9 items: `skin`, `face`, `bridal`, `waves`, `updo`,
`consult`, `team`, `pricing`, `brand`) is a curated label set already shown in the Skill Passport UI.
Only `skin`/`face`/`waves` currently receive real evidence (via `STAGE1_MISSION_SKILL_MAP`, keyed by
`root_mission_id`). `getSkillMastery()` (`lib/student/mastery.ts`) already aggregates real
`learning_skill_evidence` rows by `skill_key` — it does not read the hardcoded demo array directly.

Decision: the Daily Log skill picker reuses these same 9 ids/labels rather than inventing a new
22-code taxonomy. This means tagging a Daily Log entry with e.g. `bridal` or `consult` starts feeding
**real** mastery data into skills that today only show fabricated demo progress — a genuine
improvement, not a parallel vocabulary. `STAGE1_MISSION_SKILL_MAP` (Mission-completion signal) is
left untouched; Daily-Log-tagged evidence and Mission-completion evidence are two honestly-separate
signals under the same skill_key space, both visible in the Skill Passport.

## 4. Migration design (additive only)

See `supabase/migrations/0056_h2obook_learning_journey_intelligence_v1.sql`.

1. `learner_experiences.knowledge_space_id` becomes nullable (mirrors exactly what migration 0053
   did to `learner_notes.knowledge_space_id`); add `mission_id uuid references learning_journey_missions(id)`;
   replace the subject constraint with `knowledge_space_id is not null or mission_id is not null`.
2. Add nullable columns: `journey_day int (1-90)`, `best_result text`, `suspected_reason text`,
   `self_score numeric(5,2) (0-100)`, `instructor_score numeric(5,2) (0-100)`, `practice_minutes int (>=0)`.
3. New table `learning_capability_snapshots` (weekly/day30/day60/day90), RLS: self-or-staff read,
   staff-only insert (generation runs through the admin/service client; the staff policy is a safety
   net, same shape as `learning_results`' `"results service write"` policy).

No table is dropped or renamed. No existing column changes type or becomes NOT NULL. No Stage/Mission
row, id, or unlock query is touched.

## 5. Compatibility adapter for folder 36

`lib/stage1-learning-os/daily-practice.ts` keeps its exact exported function signatures
(`saveDailyPracticeEntry`, `listDailyPracticeEntries`) and `DailyPracticeEntry` shape — only the
table/columns underneath change (`learner_notes` → `learner_experiences`). `app/api/student/practice/route.ts`
and the existing fields of `components/student/mission-workspace/daily-practice-logger.tsx` do not
need to change their contract; the richer V1 fields (skill tags, best_result, suspected_reason,
self_score, practice_minutes) are added as optional/additive extensions on top, not a replacement of
the existing request/response shape.

## 6. Risk and rollback

Risk: low. Every new column is nullable; the only new NOT NULL constraint is the OR-subject check,
which cannot fail against existing rows because `learner_experiences` has zero real rows in
production today (verified by direct query 2026-08-14). Rollback is a plain drop of the new table and
new columns, included at the foot of the migration file, matching every prior migration's convention
in this repo.
