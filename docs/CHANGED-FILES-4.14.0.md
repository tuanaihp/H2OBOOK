# H2OBOOK 4.14 changed-file map

## New public layer

- `components/marketing/public-shell.tsx`
- `lib/public-site/content.ts`
- `app/page.tsx`
- `app/academy/layout.tsx`
- `app/academy/books/*`
- `app/academy/courses/*`
- `app/academy/strategies/*`
- `app/academy/learning-paths/page.tsx`
- `app/academy/about/page.tsx`
- `app/academy/membership/page.tsx`
- `app/academy/success-stories/page.tsx`
- `app/api/public/catalog/route.ts`

## New student layer

- `components/student/student-shell.tsx`
- `lib/student/experience.ts`
- `app/student/layout.tsx`
- `app/student/page.tsx`
- `app/student/courses/*`
- `app/student/library/page.tsx`
- `app/student/assignments/page.tsx`
- `app/student/roadmap/page.tsx`
- `app/student/mentor/page.tsx`
- `app/student/profile/page.tsx`

## Updated integration files

- `middleware.ts`: public routes and student-role redirect.
- `app/login/page.tsx`: role-aware production landing and two Demo Mode entries.
- `app/layout.tsx`: 4.14 metadata.
- `components/layout/sidebar.tsx`: version label only; workspace navigation preserved.
- `app/dashboard/page.tsx`: version label only.
- `app/globals.css`: isolated `h2o-public-*` and `h2o-student-*` visual systems.
- `.env.example`: two rollout flags.
- `public/manifest.webmanifest`: 4.14 PWA metadata/shortcuts.
- `package.json` and `VERSION`: 4.14.0.
- validators updated to accept the newer compatible release branch.

## Safety rule

Do not copy only `app/page.tsx` or `app/globals.css` into production. Integrate the full changed-file set on a Git feature branch, because middleware, feature flags, navigation, catalog data and CSS are designed to work together.
