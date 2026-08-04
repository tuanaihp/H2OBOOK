# H2OBOOK — Auto-Login After Confirmation, Google Sign-In & Root-Cause Trigger Hardening

Branch: `feature/auto-login-google-signin-hardening`
Trigger: follow-up to the student self-signup fix — user reported (1) confirmation emails
redirecting to `localhost:3000` with `otp_expired`, (2) wanting automatic login after email
confirmation, (3) wanting a "Sign up with Google" button.

## 1. What requires action in the Supabase Dashboard (cannot be done from this repo)

- **Site URL** is still set to `http://localhost:3000` in Authentication → URL Configuration —
  this is why every confirmation email points at `localhost:3000` and fails in production. Must
  be changed to `https://h2obook-app.vercel.app`, with `https://h2obook-app.vercel.app/auth/callback`
  and `https://h2obook-app.vercel.app/**` added to Redirect URLs. **Given step-by-step in chat,
  not something this session can change directly** (no Supabase dashboard access).
- **Google OAuth provider** must be enabled in Authentication → Providers → Google, with a
  Client ID/Secret created in Google Cloud Console. The code side (this branch) is ready and
  waiting — the button will start working the moment the provider is enabled, no further code
  change needed.

## 2. Root-cause hardening (migration 0032)

The student-signup fix (previous branch) stopped the one specific bug that had actually fired in
production (`/signup` explicitly sending `role:"owner"`), but the underlying trigger default was
still unsafe: `handle_new_user()`'s condition was
`coalesce(new.raw_user_meta_data->>'role','owner')='owner'` — true whenever role is `'owner'`
**or absent**. Google/OAuth sign-in does not let the client set custom `raw_user_meta_data.role`
the way `supabase.auth.signUp()` does, so adding a Google button on top of the old trigger would
have silently reintroduced the exact same incident through a new path — every Google sign-in
would have created a brand-new Owner workspace.

`supabase/migrations/0032_h2obook_safe_signup_default.sql` changes the condition to
`new.raw_user_meta_data->>'role'='owner'` (no default) — only an explicit, deliberate `role:
"owner"` now creates a workspace. Everything else (no role, `role:"student"`, Google/OAuth with
no custom metadata at all) creates no organization. This is a pure `create or replace function`
— no table, no data, no RLS touched.

## 3. Auto-login after confirmation / OAuth (application layer)

- `app/auth/callback/route.ts` now completes the real academy-student join itself, right after
  `exchangeCodeForSession` succeeds: if the resolved session role is `"student"` (which
  `getCurrentUser()` already defaults to for any session with no real `organization_members` row
  — a pre-existing, safe fallback), it calls the same `joinAcademyAsStudent()` used by
  `/api/auth/register-student`, then redirects to `next`. This is what makes "confirm → land
  straight in `/student`, already joined" work for **every** flow that goes through this one
  callback route: email confirmation, magic links, and Google OAuth alike — not just password
  signup.
- `components/marketing/signup-form.tsx`'s `emailRedirectTo` now includes `?next=/student`, so a
  confirming student lands exactly where they should instead of the default `/dashboard`.

## 4. Google Sign-In

- New shared `components/marketing/google-glyph.tsx` (the official 4-color "G" mark).
- Added a "Đăng nhập bằng Google" / "Đăng ký bằng Google" button, calling
  `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: ".../auth/callback?next=..." } })`,
  to all three forms: `components/public-academy-v5/public-login-experience.tsx` (the active
  default login), `components/marketing/legacy-login-form.tsx` (used only when
  `NEXT_PUBLIC_AUTH_EXPERIENCE_V2=false`), and `components/marketing/signup-form.tsx`.
- Google sign-in is routed through the exact same `/auth/callback` handler as everything else —
  no separate code path, so §2's trigger fix and §3's auto-join logic apply to it automatically.
  A brand-new Google sign-in lands directly in `/student`, already joined as a student, exactly
  like a confirmed email signup.

## 5. Files changed

**New**: `supabase/migrations/0032_h2obook_safe_signup_default.sql`,
`supabase/_RUN-0032-ONLY.sql`, `components/marketing/google-glyph.tsx`.
**Modified**: `app/auth/callback/route.ts`, `components/marketing/signup-form.tsx`,
`components/public-academy-v5/public-login-experience.tsx`,
`components/public-academy-v5/public-auth-v5.module.css`,
`components/marketing/legacy-login-form.tsx`, `supabase/_RUN-ONCE-COMBINED-MIGRATIONS.sql`.

## 6. Tests executed

| Command | Result |
|---|---|
| `pnpm typecheck` | ✅ 0 errors |
| `pnpm lint` | ✅ 0 errors, 51 pre-existing warnings, none new |
| `pnpm test` (vitest) | ✅ 22 files / 72 tests passed, no regressions |
| `pnpm test:sql` | ✅ passed |
| `pnpm validate:migrations` | ✅ 32 sequential migrations |
| `pnpm smoke` | ✅ passed |
| `pnpm build` | ✅ compiled successfully; `/signup`, `/login`, `/auth/callback`, `/unauthorized` all present |

Not executed: an actual Google OAuth round trip (provider isn't enabled in Supabase yet) or a
real confirmation-email click (Site URL isn't fixed yet) — both require the Dashboard steps in §1
to be completed first. Code is ready and will work as soon as those two settings are applied; not
claimed as verified end-to-end in this session.

## 7. Risks / what remains

- **Google button is inert until the Dashboard provider is enabled** — clicking it today will
  fail with a clear Supabase error message (not a silent failure), not a crash.
- **Confirmation emails already sent before the Site URL fix will still 404/localhost-fail** —
  only new emails sent after the Dashboard fix will use the correct domain.
- Same limitation as the prior report: accounts that already became stray Owners before these
  fixes are not retroactively repaired by this change.

## 8. Rollback

- Revert the merge commit, or `git revert` this branch's commit range.
- Migration rollback: re-apply 0024's original `handle_new_user()` body (restores the
  `coalesce(...,'owner')` default) — not recommended, since that is the exact behavior the
  incident traced back to.
