# Owner Action Checklist — H2OBOOK 4.13.5

1. Run `pnpm install` and commit `pnpm-lock.yaml`.
2. Run Phase 5 unit tests and Next production build.
3. Verify `FILE_SCAN_URL`, R2 and Supabase are configured before production HTML source upload.
4. Test a public page containing relative links and images.
5. Confirm images become Asset records and are not left as external hotlinks.
6. Test malformed and malicious HTML fixtures.
7. Confirm private-network and localhost URLs are blocked.
8. Review the controlled embed host allowlist before customer rollout.
9. Set legal/usage rules for importing third-party websites and images.
10. Continue with Phase 6; do not add more parser-specific commit flows.
