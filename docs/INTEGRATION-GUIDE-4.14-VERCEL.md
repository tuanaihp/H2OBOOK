# Integrating H2OBOOK 4.14 into the existing Vercel app

## Do not copy into Vercel output

Vercel deployments are build artifacts. Integrate the files into the Git repository that currently deploys `h2obook-app`, then let Vercel build a Preview deployment.

## Recommended commands

```bash
git checkout main
git pull
git tag h2obook-4.13.7-production
git checkout -b feature/h2obook-4.14-student-public
# integrate this source
git add .
git commit -m "feat: H2OBOOK 4.14 student and public academy"
git push origin feature/h2obook-4.14-student-public
```

Review the Vercel Preview. After approval:

```bash
git checkout main
git merge feature/h2obook-4.14-student-public
git push origin main
```

## Route ownership

- `/`, `/academy/*`: public website.
- `/student/*`: authenticated learner experience.
- Existing workspace routes remain unchanged.

## Rollback

Set:

```env
NEXT_PUBLIC_PUBLIC_SITE_V2=false
NEXT_PUBLIC_STUDENT_EXPERIENCE_V2=false
```

Redeploy. This hides the new layers without deleting database schema or old routes.
