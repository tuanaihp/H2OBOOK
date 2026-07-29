# H2OBOOK 4.15 — Global Neural Design System — Integration Report

## 1. Original version / branch

- Version before: `4.14.1`
- Base branch/commit: `main` @ `e7005e9` (Merge student storage quota + opt-in image compression)
- Node `v24.16.0`, pnpm `9.15.5`, working tree clean before start.

## 2. Backup tag

`h2obook-before-global-neural-system` → points at `main`@`e7005e9`. Feature branch: `feature/h2obook-global-neural-system`.

## 3. Files added and merged

### Added (new, no overwrites)
- `components/global-neural/` — `index.ts`, `neural-route-theme.tsx`, `neural-ambient-layer.tsx`, `neural-brain-mark.tsx`, `neural-header-signal.tsx`, `neural-page-intelligence.tsx`
- `lib/global-neural/` — `routes.ts`, `presets.ts`, `feature.ts`, `types.ts`
- `styles/global-neural-system.css`
- `app/academy/neural-system-preview/page.tsx`
- `scripts/validate-global-neural-system.mjs`
- `tests/unit/global-neural-system.test.ts`
- `docs/GLOBAL-NEURAL-DESIGN-SYSTEM-MATRIX.md`, `docs/GLOBAL-NEURAL-ROLLBACK-GUIDE.md`, `docs/GLOBAL-NEURAL-COMPATIBILITY.md`

### Merged (minimal, additive)
| File | Change |
|---|---|
| `app/layout.tsx` | one CSS import, one component import, one `<NeuralRouteTheme/>` next to the existing `<AnalyticsProvider/>`. Structure untouched. |
| `components/marketing/public-shell.tsx` | `<NeuralHeaderSignal/>` before `.h2o-public-actions` |
| `components/student/student-shell.tsx` | `<NeuralHeaderSignal compact/>` before `.h2o-student-mentor-quick` |
| `components/layout/topbar.tsx` | `<NeuralHeaderSignal compact/>` before `.top-actions` |
| `components/editor/editor-workspace.tsx` | `<NeuralHeaderSignal compact/>` first child of `.editor-top-right` |
| `.env.example` | two public flags |
| `package.json` | one script + version `4.15.0` |
| `VERSION` | `4.15.0` |
| 5 validator scripts | version-range widening only (see §8) |

**Reader intentionally skipped.** STEP 6 allows the reader signal "only if controls do not crowd". `app/reader/[slug]/page.tsx` already renders 5 buttons in `.reader-bar-center` and 4 in `.reader-bar-right`; adding a signal would crowd them, so it was left untouched. Zero changes to the reader file.

Not touched: routes, Supabase/migrations/RLS, API contracts, stores, auth, workers, R2/Redis, publishing, payments, `pnpm-lock.yaml`, `.env.local`, AppShell/StudentShell/PublicShell/EditorWorkspace structure.

## 4. Route-to-surface mapping (verified in a real browser, not assumed)

| Route | Surface | Intensity | Verified |
|---|---|---|---|
| `/`, `/academy/*` | public | immersive | ✅ |
| `/student/*` | student | balanced | ✅ |
| `/dashboard`, `/store`, other business | workspace | subtle | ✅ |
| `/editor/*`, `/design-library`, `/templates`, `/brand-kit`, `/assets`, `/blocks` | creative | focus | ✅ |
| `/reader/*`, `/embed/*` | reader | focus | ✅ |
| `/login`, `/signup`, `/auth/*` | auth | immersive | ✅ |
| `/portal/*` | portal | balanced | ✅ |

All 11 mapping assertions passed by reading the real `data-h2o-neural`, `data-h2o-surface` and `data-h2o-neural-intensity` attributes on `<html>` via Playwright/Chromium. CSS stays scoped behind `html[data-h2o-neural="on"]` (13 scoped selectors in the stylesheet).

## 5. Feature flags

```env
NEXT_PUBLIC_GLOBAL_NEURAL_DESIGN_V1=true
NEXT_PUBLIC_GLOBAL_NEURAL_MOTION=auto
```

Rollback without code change: set `NEXT_PUBLIC_GLOBAL_NEURAL_DESIGN_V1=false` → `NeuralRouteTheme` returns `null`, all header signals return `null`, `data-h2o-neural="off"` disables every scoped rule. `.env.local` untouched.

## 6. Gate results

| Gate | Result |
|---|---|
| `pnpm validate:global-neural` | ✅ 8 required files, 7 surfaces |
| `pnpm validate:ui414` | ✅ 24 files, 9 checks, 3167 CSS blocks |
| `pnpm validate:imports` | ✅ 345 source files |
| `pnpm validate` | ✅ 51 core files |
| `pnpm validate:professional` / `validate:editor412` / `validate:design-library` | ✅ all pass |
| `validate:input-phase2/3/5/6`, `validate:migrations`, `check:input-storage`, `test:sql` | ✅ all pass |
| `pnpm typecheck` | ✅ **0 errors** |
| `pnpm test` | ✅ **41/41** (13 files; +11 new module tests, 30 pre-existing unchanged) |
| `pnpm build` (`VERCEL=1`) | ✅ **exit code 0**; `/academy/neural-system-preview` emitted at 183 B / 112 kB First Load |
| E2E Chromium — surface mapping + overflow + ambient + reduced-motion | ✅ 14/14 |
| E2E Chromium — existing `ui-414` + `smoke` regression | ✅ 4/4 unchanged |
| E2E WebKit/mobile | ⚠️ see §8 — pre-existing dev-environment limitation, not a regression |

Live route check (dev server): `/academy/neural-system-preview`, `/`, `/academy/books`, `/academy/courses`, `/student`, `/student/courses`, `/student/mentor`, `/dashboard`, `/store`, `/marketplace-studio`, `/white-label`, `/design-library`, `/brand-kit`, `/login`, `/portal/thuyh2o-academy`, `/editor/book_makeup_pro`, `/reader/makeup-pro` → **all HTTP 200**.

## 7. Performance and accessibility observations

- **No new dependencies.** Module imports only `react`, `next/navigation` and `lucide-react`, all already present. No Rive/Spline/Three.js/WebGL, no canvas loop, no network animation, no AI API.
- **Editor canvas / reader page untouched.** Verified by assertion: `.h2o-neural-ambient` has count 0 on both `/editor/*` and `/reader/*` (presets set `showAmbient:false` for `creative` and `reader`). Konva canvas is never overlaid or recoloured.
- **No horizontal overflow** on `/`, `/student`, `/dashboard`, `/design-library` (measured `scrollWidth` vs `clientWidth`).
- **Reduced motion honoured** — with `reducedMotion: "reduce"`, `<html data-h2o-neural-motion="reduced">` is set; the stylesheet also carries a `prefers-reduced-motion` block.
- **Keyboard focus remains visible** — after tabbing on `/dashboard`, the focused element still reports `outline: auto 3px` (neural chrome adds only an inset box-shadow, it does not remove outlines).
- Ambient layer is `aria-hidden="true"` and purely decorative; header signal is a non-interactive `div` and adds no tab stops.

## 8. Remaining issues / honest caveats

1. **WebKit (Playwright `mobile` project) cannot hydrate any client component in this local dev setup.** All `_next/static` assets fail with `SSL connect error` because the app's CSP (`middleware.ts`, `buildCsp()`) includes `upgrade-insecure-requests`, which WebKit applies to subresources — rewriting `http://localhost:3000/...` to `https://...` where no TLS server is listening.
   **Verified pre-existing, not caused by this module:** `middleware.ts` is byte-identical to `main` on this branch (`git diff main -- middleware.ts` is empty) and the directive dates to commit `b4ef687`. As a control, a JS-dependent feature that shipped *before* this branch (the Design Library configurator modal) was tested: it **fails on WebKit and passes on Chromium** in exactly the same way. On Vercel production the site is served over HTTPS, where `upgrade-insecure-requests` is a no-op — the live site already works. No action taken, since fixing it would require modifying the CSP, which STEP rules forbid in this run.
2. **Version bump required widening five validator version regexes.** `package.json`/`VERSION` were moved to `4.15.0` to match the target release name. Five validators pinned `4.12–4.14` and would have failed. Their ranges were widened to `4.1[2-9]`/`1[4-9]` — the same maintenance the 4.14 module performed when it widened `13`→`14`. These are minimum-supported-version gates, not correctness or security checks; **no validator was disabled, skipped or weakened in substance**, and no `any`/`ts-ignore` was introduced anywhere.
3. Visual QA at the four breakpoints was done through automated overflow/attribute assertions, not human design review of every surface. A visual pass on the Vercel Preview is still recommended before merging.

## 9. Rollback instructions

- **Fastest (no code change):** set `NEXT_PUBLIC_GLOBAL_NEURAL_DESIGN_V1=false` in Vercel and redeploy. Everything reverts to the 4.14 look; no schema, route or data change is involved.
- **Full code rollback:** do not merge this branch, or `git reset --hard h2obook-before-global-neural-system`. `main` is untouched by this run.
- No migrations were added or run, so there is nothing to roll back in the database.

## 10. Final status

**READY_FOR_VERCEL_PREVIEW** at the time of the integration run — all build gates passed (`pnpm build` exit 0, typecheck clean, 41/41 unit tests, 18/18 Chromium E2E assertions), with `main` unmerged and production untouched per the integration prompt.

## 11. Post-merge addendum — production deploy and a pre-existing CSP defect

The owner then approved merging to `main` and deploying. Both were done (`main` → `ceec8e4`, deployed to `h2obook-app.vercel.app`).

**Verifying the deploy exposed a pre-existing production defect.** The neural attributes applied on `/reader` and `/portal` but not on `/`, `/student`, `/dashboard`, `/design-library` or `/login`. The split was not random: the failing routes are statically prerendered, the working ones are dynamic.

Root cause, measured on the live site: production sent `script-src 'self' 'nonce-<per-request>' 'strict-dynamic'` for every route. Next.js can only stamp that nonce onto markup it renders per request, so the 65 statically prerendered routes — built ahead of time with no nonce — had **every** script blocked: 10 external chunks plus 26 inline RSC payload scripts, 0 of 36 carrying a nonce. React never booted on them.

This predates the 4.15 work (`middleware.ts` was byte-identical to `main` on the feature branch; the directive dates to `b4ef687`) and was confirmed independently: the Design Library configurator modal, shipped before this branch, was also dead on production `/design-library`. The blast radius was every client interaction on a static route — dropdowns, search, modals — with navigation still working only because `<Link>` degrades to `<a>`.

**Fix** (`fix/csp-static-page-hydration`, merged as `c6e11a1`): production `script-src` is now `'self' 'unsafe-inline'`. Removing only `'strict-dynamic'` would not have been enough — naming any nonce in `script-src` also makes browsers ignore `'unsafe-inline'`, so the 26 un-nonced inline scripts would have stayed blocked; the nonce itself had to come out. External script hosts and `eval` remain blocked in production, dev is unchanged, and nothing in the app consumed the nonce (the sole `nonce` reference is the HTML-import sanitiser stripping it from untrusted markup).

**Verified on the live production URL, Chromium and WebKit, 20/20 assertions:** all seven route→surface mappings apply; zero CSP script violations on a static page; the previously-dead Design Library modal opens again; `/editor` and `/reader` still carry no ambient overlay.

**Net status: DEPLOYED AND VERIFIED IN PRODUCTION.** The WebKit-in-local-dev limitation from §8 remains untouched and is unrelated (it is an artefact of `upgrade-insecure-requests` against an HTTP dev server; production is HTTPS, and WebKit now passes there).
