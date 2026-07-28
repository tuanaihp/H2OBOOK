# Owner Action Checklist — H2OBOOK 4.14

1. Create branch `feature/h2obook-4.14-student-public` from the deployed commit.
2. Replace/add the 4.14 source files in the same repository; do not create a second Vercel project.
3. Add environment variables:
   - `NEXT_PUBLIC_PUBLIC_SITE_V2=true`
   - `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=true`
4. Run `pnpm install` and commit the verified `pnpm-lock.yaml`.
5. Run `pnpm validate:ui414`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
6. Push the feature branch and review the Vercel Preview URL.
7. Test public routes while signed out.
8. Test `/student` using a real student account.
9. Test owner/admin access to existing `/dashboard`, `/editor`, `/store`, and `/marketplace-studio`.
10. Verify mobile navigation and auth redirects.
11. Merge to `main` only after Preview approval.
12. Roll back instantly by setting either 4.14 feature flag to `false` and redeploying.

## Production data follow-up

Replace curated local catalog/student fixtures with Supabase read models only after the UI is approved. Keep the present adapters as Demo Mode fallback.
