# Changelog

## 4.13.7 — Production Validation & Hardening

- Added bounded input/session/payload policies and privacy-safe trace logging.
- Added worker heartbeat, timeout, cancellation, stalled-job recovery and idempotent retry.
- Hardened DOCX archives, upload filenames, MIME/magic validation and SSRF protections.
- Added stricter Input Session RLS, stale-session recovery and hardened atomic commit RPC.
- Added production health checks, staged rollback flag, deployment/incident runbooks and hostile/performance fixtures.
- Classified the build as a source-complete release candidate pending lockfile, full build and external service gates.

## 4.13.6 — Unified Input Orchestrator

- Added one session/state machine for DOCX, PDF, Image, HTML, Markdown, TXT and URL.
- Added common preview, destination, retry, cancel, recovery and offline session cache.
- Added idempotent PostgreSQL sessions and atomic semantic/design commits.
- Added worker-job linking, domain/analytics events and Realtime publication.
- Added `/input` gateway and deprecated direct editor imports behind a legacy compatibility panel.
- Added migration 0021, unit/runtime validators and Phase 6 documentation.

## 4.13.5 — HTML Import 2.0

- Added direct HTML/HTM/XHTML file upload and canonical URL parsing through JSDOM.
- Added server-side sanitization, controlled embeds, relative URL resolution and charset detection.
- Added semantic reconstruction for headings, rich paragraphs, nested lists, tables, figures, links and media.
- Added SSRF-safe remote image localization through the existing Asset Engine.
- Added sandboxed preview, unit fixtures, Phase 5 validator and Claude progress documentation.

## 4.13.4 — Image Smart Import

- Added four image-import modes: asset, full page, OCR and manual regions.
- Added `.jpe`, EXIF/DPI/profile inspection, stored-object magic validation and SHA-256 metadata.
- Added deterministic Tesseract region OCR and semantic preview without mandatory AI.
- Added manual text/image/ignore regions, cropped asset materialization and persisted region plans.
- Added asset variants, thumbnail foundation and image-quality preflight.
- Added migration 0020, tests, fixtures, validator and Phase 4 documentation.

## 4.13.3 — PDF Dual Import

- Added PDF inspection and fixed-layout/editable/OCR mode selection.
- Added PDF.js text-layer semantic reconstruction in Demo Mode.
- Added PyMuPDF text spans, reading order, image and table reconstruction in Production Mode.
- Added Tesseract OCR bounding boxes, confidence and correction preview.
- Added extracted PDF asset materialization and Phase 3 validation.

# 4.12.1 — Claude Guided Input Engineering

- Added root `CLAUDE.md` with mandatory no-AI-first, compatibility, security and phase rules.
- Added phase-by-phase Unified Input Engine specifications for DOCX, PDF, image and HTML.
- Added Claude Code project commands for status audit, phase execution, error repair and validation.
- Added machine-readable input roadmap, acceptance matrix, error catalog and debugging runbook.
- Added source capability audit and guidance validator scripts.
- Added synthetic HTML fixtures and fixture policy.
- No production input parser behavior was changed in this documentation-focused release.

## 4.12.0 — Professional Compose & Text Flow Editor

- Thay Compose Mode cũ bằng Tiptap/ProseMirror schema-based.
- Semantic ID round-trip cho chapter, section, heading, paragraph, list, table, image, footnote và citation.
- Text Flow Engine nhiều frame/trang với Canvas measurement và overflow diagnostics.
- Text Flow controls, continuation page, canvas badges và preflight rules.
- Publishing bridge cho rich marks, link, table, footnote, citation và flow metadata.
- Nâng kích thước toàn bộ editor controls, panel typography và mobile layout.
- Giữ tương thích storage cũ bằng Zustand persist migration.

## 4.11.0 — Professional Authoring & Publishing Integrated Suite

- Production Repository/Service/API foundation.
- Semantic Content Model và Asset ID architecture.
- Compose Mode, JSON Patch history, preflight và QR local.
- HTML/PDF/EPUB/SCORM/xAPI publishing.
- Universal ingestion.
- CSV/Sheets bulk publishing.
- Growth Reader + protected embed + cloud campaigns.
- Student Remix, Class View và accessibility controls.
- Analytics event SDK, checkout/purchase events.
- Optional AI policy với local fallback.
- Marketplace/enterprise schema, public API key auth.
- Encrypted webhook secrets, automatic delivery queue và retry worker.
- 18 database migrations.

## 4.0.0 — Smart Core

- Offline-first learning tools.
- Smart UI.
- AI optional architecture.

## 4.13.2 — Word Import 2.0

- Replaced DOCX raw-text chunking with Mammoth HTML conversion and semantic reconstruction.
- Preserved heading, paragraph, rich marks, links, nested lists, tables, images, captions, page breaks and best-effort footnotes.
- Added explicit Word preview and direct `BookDocument` commit to Compose.
- Added Asset/R2 handling for embedded Word media without Base64 book payloads.
- Added structured `python-docx` fallback with direct BookDocument output.
- Added Phase 2 unit tests, validator and Claude progress report.

## 4.14.0 — AI Student Experience & Public Academy

- Added public ThuyH2O Makeup Academy website at `/` and `/academy/*`.
- Added books, courses, strategy hub, learning paths, about, membership and success-story presentation pages.
- Added Student Learning Command Center at `/student/*`.
- Added student course, library, assignment, roadmap, local Mentor, profile and portfolio UI.
- Added mobile-first student bottom navigation.
- Added student role redirect in middleware and login flow.
- Added public read-only catalog API.
- Added safe feature flags for public/student V2 rollout.
- Kept all existing H2OBOOK Business, Editor, Input and Publishing routes unchanged.
