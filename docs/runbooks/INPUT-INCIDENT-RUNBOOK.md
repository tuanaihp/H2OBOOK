# H2OBOOK Input Incident Runbook

## First response

1. Capture the `x-trace-id`, Input Session ID and Document Job ID.
2. Open `/api/health/input` from the private monitoring network.
3. Check `input_sessions`, `input_session_events`, `document_jobs` and `document_job_events`.
4. Do not copy document text, OCR content, personal data or signed R2 URLs into tickets.

## Common incidents

### Queue unavailable

Expected code: `REDIS_NOT_CONFIGURED`, connection timeout or queue failure.

- Stop new production imports or switch the feature flag off.
- Restore Redis.
- Retry the existing Input Session; do not create a new session.

### Worker timed out

Expected code: `WORKER_TIMEOUT` or `INPUT_PROCESSING_TIMEOUT`.

- Confirm processor health and resource pressure.
- The recovery sweeper moves stale sessions to `recovery_required`.
- Retry after fixing the dependency.

### Malware or archive attack

Expected code: `ASSET_SCAN_BLOCKED`, `ZIP_BOMB_RISK`, `ZIP_PATH_TRAVERSAL`, `ZIP_SYMLINK_NOT_ALLOWED`.

- Keep the asset quarantined.
- Do not download it to a workstation.
- Record only hash, MIME, size, asset ID and reason.

### SSRF attempt

Expected code: `PRIVATE_ADDRESS_BLOCKED`, `PRIVATE_HOST_BLOCKED`, `URL_CREDENTIALS_NOT_ALLOWED`.

- Preserve trace metadata.
- Review repeated attempts by user/workspace and rate-limit identity.
- Never allowlist private metadata endpoints.

### Version conflict

Expected code: `INPUT_VERSION_CONFLICT`.

- Keep preview and corrections.
- Reload the target book.
- Choose append, replace with the new expected version, or create a new book.

## Safe telemetry fields

Allowed: trace ID, session/job ID, organization ID, format, mode, duration, page/node/asset counts, warning codes, retry count and failure code.

Forbidden by default: document content, OCR text, email, phone, address, authorization headers, cookies, tokens, secrets and signed URLs.
