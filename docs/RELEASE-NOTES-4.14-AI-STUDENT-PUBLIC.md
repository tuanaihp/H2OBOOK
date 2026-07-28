# H2OBOOK 4.14 — AI Student Experience & Public Academy

## Scope

This release adds two presentation layers to the existing H2OBOOK codebase without replacing the Business/Admin workspace:

1. Public Academy website at `/` and `/academy/*`.
2. Student Learning Command Center at `/student/*`.

## Public Academy

- Future-AI visual system tailored to ThuyH2O Makeup Academy.
- Public home page with books, courses, career paths, strategy hub, student experience, real-world practice, stories and memberships.
- Public catalog and detail pages for books, courses and strategy playbooks.
- Public career path, about, membership and success-story pages.
- Read-only public catalog API at `/api/public/catalog`.
- Public routes are accessible without authentication in production middleware.

## Student Experience

- Dedicated student shell, navigation and mobile bottom navigation.
- Personalized dashboard with today's mission, learning continuation, local Mentor, Skill Map, career milestone, assignments and achievements.
- Course list and course detail.
- Student library.
- Assignment board.
- Career Roadmap and detailed skill map.
- H2O Mentor with deterministic local recommendations; external AI remains optional.
- Profile, certificates, achievements and portfolio foundation.

## Safe rollout

- `NEXT_PUBLIC_PUBLIC_SITE_V2`
- `NEXT_PUBLIC_STUDENT_EXPERIENCE_V2`
- Student users are redirected to `/student` after login.
- Business/Admin routes remain unchanged.
- Recommended deployment: feature branch → Vercel Preview → merge to production.

## Data status

The visual experience uses curated local catalog and learning fixtures on top of the existing Zustand demo data. Production Supabase catalog/enrollment queries are the next integration layer; no fake claim is made that those new pages are already database-driven.
