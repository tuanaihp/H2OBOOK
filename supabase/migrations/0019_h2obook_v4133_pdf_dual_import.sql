-- H2OBOOK 4.13.3 — PDF Dual Import
-- Add the semantic PDF reconstruction job while preserving all legacy document jobs.

alter table public.document_jobs
  drop constraint if exists document_jobs_job_type_check;

alter table public.document_jobs
  add constraint document_jobs_job_type_check
  check (job_type in ('pdf_import','pdf_reconstruct','docx_import','ocr','thumbnail','pdf_export','health_scan'));

create index if not exists document_jobs_pdf_reconstruct_idx
  on public.document_jobs (organization_id, created_at desc)
  where job_type = 'pdf_reconstruct';

comment on column public.document_jobs.job_type is
  'Document processing job. pdf_reconstruct converts native PDF text/images/tables into BookDocument; ocr is deterministic Tesseract fallback for scanned pages.';
