# H2OBOOK Creative Publishing Operations V1 — Integration Report

- Branch: `feature/creative-publishing-ops-v1`
- Backup tag: `h2obook-before-creative-publishing-ops-v1` (on `main`, pre-integration)
- Baseline: `main` @ `9ddc036` (v5 folder 3 of 6; independent branch, not stacked on module 1)
- Module source: `H2OBOOK-CREATIVE-PUBLISHING-OPS-V1-UNIFIED-MODULE`
- Package version bumped: `4.17.0` → `4.18.0`

## Scope

A single dynamic preview route (`/creative-publishing-v1-preview/[surface]`) unifying the header,
pipeline stepper and shared UI primitives for all 12 Creative surfaces (assets, ingestion, blocks,
books, brand-kit, templates, design-library, clones, bulk-publishing, editor, content-health,
publish). Per the module's own README and integration prompt, this is explicitly a **foundation**
pass: route structure, shared UI, data handoff contract, analytics events, feature flags — real
production routes are only switched over "after the 12 preview routes pass," and the module's own
default is `NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1=false`. This integration matches that scope:
the preview surface is fully wired and verified; **no existing production route
(`/assets`, `/books`, `/brand-kit`, etc.) was changed** in this pass — see Known limitations for
why, and Deferred production wiring for what step 7 of the prompt would require next.

## Files added

`app/creative-publishing-v1-preview/[surface]/page.tsx`, `components/creative-publishing-v1/*`
(`index.ts`, `creative-publishing-preview.tsx`, `creative-publishing-v1.module.css`,
`creative-shared.tsx`, `editor-creative-handoff-bridge.tsx`, `pages/*.tsx` — 12 surface
components), `lib/creative-publishing-v1/*` (`bulk.ts`, `editor-handoff.ts`, `events.ts`,
`feature.ts`, `registry.ts`, `types.ts`), `scripts/validate-creative-publishing-v1.mjs`,
`tests/unit/creative-publishing-v1.test.ts`. Module README kept for reference under
`docs/v5-modules/creative-publishing-ops-v1/`; its own `CLAUDE-INTEGRATION-PROMPT.md` copy was
not kept (same `=====`-as-merge-marker false positive as module 1 — see that report).

## Files merged

- `.env.example` — appended `NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1=false` and
  `NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_PREVIEW=true`, exactly as specified.
- `package.json` — added `validate:creative-publishing-v1` script; version bump only (no new
  dependency — the module uses only `lucide-react`, `next/link`, `next/navigation`, all existing).
- `components/editor/editor-workspace.tsx` — mounted `<EditorCreativeHandoffBridge/>` as the
  first child of the editor shell, per the prompt's explicit instruction ("chỉ mount
  EditorCreativeHandoffBridge... không bọc toàn Editor bằng page mới"). `EditorWorkspace`,
  `useEditorStore`, the canvas and every existing editor action are otherwise untouched.

## Bugs found and fixed (pre-existing in the module, not introduced here)

All three were confirmed live (build/browser), not assumed from reading code:

1. **Type error** (`components/creative-publishing-v1/pages/editor-studio-v1.tsx`): a mixed
   `[LucideIcon, string, string][]` array was declared without a type annotation, so TypeScript
   widened every element (including the two strings) to `string | LucideIcon`, and rendering
   `{title}`/`{description}` as JSX children failed (`TS2322`, a bare component reference is not
   a valid `ReactNode`). Fixed by annotating the array as `[LucideIcon, string, string][]`.
2. **Rules-of-Hooks false positive that breaks the production build**
   (`components/creative-publishing-v1/pages/block-library-v1.tsx`): a plain event-handler
   function was named `useBlock`, which React's ESLint plugin treats as a hook by naming
   convention; calling it from inside `.map()` triggered `react-hooks/rules-of-hooks`, which
   `next build`'s bundled ESLint run treats as a build-blocking error, not a warning. Renamed to
   `applyBlock` (not a hook, was never one).
3. **Infinite render loop — React error #185 — on 3 of 12 surfaces** (`block-library-v1.tsx`,
   `editor-studio-v1.tsx`, `publish-center-v1.tsx`): each selected
   `useAppStore((state) => state.books.filter((book) => !book.archivedAt))`. A Zustand selector
   must return a referentially stable value when the underlying state hasn't changed; an inline
   `.filter()` allocates a new array on every read, and Zustand's `useSyncExternalStore`-based
   subscription model detects the "changed" snapshot and re-renders, which re-runs the selector,
   which allocates again — an infinite loop that crashes with React's `#185` ("Maximum update
   depth exceeded"). Confirmed live: opening `/creative-publishing-v1-preview/blocks`,
   `/editor`, and `/publish` in a real browser reproduced the console error on all three, and
   nowhere else in the repository does existing code select a derived/computed value directly
   (every existing `useAppStore` call selects a raw slice, e.g. `state.books`, `state.workspace`).
   Fixed in all three files by selecting the raw `state.books` slice and deriving the filtered
   list with `useMemo`, matching the pattern the module's own `block-library-v1.tsx` already used
   correctly for its `filtered` blocks list.
4. **CSS Grid "blowout" causing page-level horizontal overflow on mobile, on every surface**
   (`components/creative-publishing-v1/creative-publishing-v1.module.css`): `.page` is
   `display:grid` with no explicit `grid-template-columns`, so its implicit single column sizes
   to `auto` (effectively max-content). The pipeline stepper inside it
   (`.pipelineScroll{grid-template-columns:repeat(12,minmax(58px,1fr))}`, tightening to
   `repeat(12,72px)` under 1100px) has a genuine minimum content width of ~940px regardless of its
   own `overflow:auto` — that scroll behavior only clips content once the box's own width is
   resolved, it doesn't change the box's *minimum* content contribution to an ancestor's `auto`
   grid track. That minimum propagated all the way up through `.pipeline` and `.page` to
   `<html>`, so every one of the 12 preview pages measured `document.documentElement.scrollWidth`
   wider than a 390px viewport (confirmed by walking the DOM for the actual offending elements,
   not just the top-level flag). Fixed with a one-line, purely additive change:
   `.page{grid-template-columns:minmax(0,1fr)}`, which caps the implicit column at the available
   width instead of its content's intrinsic size — the standard fix for this well-known CSS Grid
   behavior. Re-verified: all 12 surfaces now report `mobileOverflow: false` at 390px and
   `desktopOverflow: false` at 1440px.

No `any`, `ts-ignore`, or disabled lint was used for any of the four fixes above.

## Editor handoff

`<EditorCreativeHandoffBridge/>` is mounted and, on mount, reads any pending
`h2obook-creative-handoff-v1` localStorage entry and dispatches a `h2obook:creative-handoff`
DOM event — this part is wired and verified (the real `/editor/[bookId]` route still renders
correctly with it mounted, 0 console errors).

**Not implemented in this pass, and explicitly flagged rather than faked:** a listener that turns
a `kind: "block"` handoff into an actual Editor element/JSON-Patch operation. The module's
`queueCreativeHandoff({ kind: "block", sourceId: blockId, targetBookId })` call
(`block-library-v1.tsx`) carries only a block ID — no serialized content. Checked the repository's
actual `ReusableBlock` type (`types/domain.ts`): it is a catalog-level stub
(`id, name, category, description, preview, elementCount, isSystem`) with **no stored element
data to insert**. Writing a listener today would mean either fabricating placeholder content (a
correctness violation) or inventing an undocumented content schema outside this UI-integration
prompt's scope. This is a real product decision (does a `ReusableBlock` need a stored, serialized
element array?) that belongs to a future pass, not a shortcut to take silently here.

## Role access

Per the prompt: "Middleware và RLS hiện tại là nguồn sự thật" — no new role was added and none of
`owner/admin/designer/content_manager/student/teacher` was touched. The preview route itself has
no route guard (matches the module's own preview-hub precedent from Operations Foundation and
Public Academy V5 — preview routes are demo-data surfaces, not production data), consistent with
`NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1_PREVIEW` being a preview-only flag.

## Feature flags

```env
NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1=false
NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_PREVIEW=true
```

## Analytics

`emitCreativeEvent()` (`lib/creative-publishing-v1/events.ts`) dispatches a browser
`h2obook:analytics` CustomEvent per action (`creative_surface_viewed`, `creative_action_clicked`,
`creative_handoff_queued`, `creative_job_started/completed/failed`); failures are caught locally
and never throw, so a listener failure cannot break a surface's primary action. No SDK wiring was
added in this pass (the module doesn't ship one) — this is a dispatch-only contract today.

## Validation results

| Command | Result |
|---|---|
| `pnpm validate:creative-publishing-v1` | Pass — 11 required core files, 12 unified surfaces, 12 ordered pipeline stages |
| `pnpm validate` | Pass — 51 core files |
| `pnpm validate:imports` | Pass — 447 source files |
| `pnpm typecheck` | Pass, 0 errors (after the `LucideIcon` tuple fix) |
| `pnpm test` | Pass — 17 files, 56 tests (incl. the module's own `creative-publishing-v1.test.ts`, 3 tests) |
| `pnpm build` | Pass (after the `useBlock`→`applyBlock` rename fixed a build-blocking ESLint error) — includes the SSG-prerendered `/creative-publishing-v1-preview/[surface]` with all 12 static params |
| Live verification (Playwright, `pnpm start`, all 12 surfaces) | Before fixes: 3/12 surfaces threw React error #185 (infinite loop), all 12/12 overflowed horizontally on a 390px viewport. After fixes: 12/12 surfaces — HTTP 200, 0 console errors, no desktop (1440px) or mobile (390px) overflow |
| Live verification of `/editor/[bookId]` with the bridge mounted | HTTP 200, editor shell renders, 0 console errors |

`pnpm test:sql` was not run — no migration in this module (explicitly forbidden by the prompt:
"Không thêm migration database trong đợt UI/integration này"), so there's nothing SQL-related to
verify. `pnpm test:e2e` (full Playwright suite) was not re-run beyond the targeted checks above,
consistent with the approach used for the other v5 modules in this batch.

## Deferred production wiring (step 7 of the module's own prompt)

Not done in this pass, and not claimed as done:
- Real routes (`/assets`, `/ingestion`, `/blocks`, `/books`, `/brand-kit`, `/templates`,
  `/design-library`, `/clones`, `/bulk-publishing`, `/content-health`, `/publish`) still render
  their existing implementations; none were switched to the V1 components. The flag
  (`NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1=false` by default) exists for exactly this future step.
- Sidebar reordering was done as instructed: `components/layout/sidebar.tsx`'s `create` domain
  previously listed its 12 links as books → studio → blocks → ingestion → templates → clones →
  brand-kit → design-library → assets → content-health → publish → bulk-publishing, which does not
  match the pipeline. Reordered the same 12 entries (no additions/removals, no icon/label/href
  changes) to assets → ingestion → blocks → books → brand-kit → templates → design-library →
  clones → bulk-publishing → editor → content-health → publish, matching the prompt's list
  exactly. The `learn`/`teach`/`business`/`system` domains were not touched.
- Bulk Publishing production engine (idempotency key, pause/resume, job progress, retry, error
  report, artifact link via `packages/automation-core`) — the preview page's CSV parser and local
  book-creation foundation are wired and tested at the preview level only.

## Rollback

`NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_V1=false` (already the shipped default) hides the module from
any future real-route wiring; the preview route itself can be hidden by setting
`NEXT_PUBLIC_CREATIVE_PUBLISHING_OPS_PREVIEW=false`. No production route was changed in this pass,
so there's nothing to fall back from there. `EditorCreativeHandoffBridge` is a 12-line, side-effect
-only component (reads localStorage once on mount, dispatches a DOM event); removing its one mount
line from `editor-workspace.tsx` fully reverts the only touch to a shared file. Backup tag
`h2obook-before-creative-publishing-ops-v1` marks `main` exactly as it was before this branch.

## Final status

**READY_FOR_CREATIVE_PUBLISHING_PREVIEW**
