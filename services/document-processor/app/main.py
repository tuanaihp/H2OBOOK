import logging
import os
import secrets
import time
import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .processors import process_job, scan_url

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("h2obook-document-processor")
app = FastAPI(title="H2OBOOK Document Processor", version="4.13.7")


class ProcessRequest(BaseModel):
    jobId: str = Field(min_length=1, max_length=160)
    organizationId: str = Field(min_length=1, max_length=160)
    type: str = Field(min_length=1, max_length=80)
    input: dict[str, Any] = Field(default_factory=dict)


class ScanRequest(BaseModel):
    downloadUrl: str = Field(min_length=8, max_length=4096)
    mimeType: str = Field(min_length=1, max_length=160)
    fileName: str = Field(default="upload.bin", max_length=240)
    sizeBytes: int = Field(default=0, ge=0)


def authorize(value: str | None) -> None:
    expected = os.getenv("DOCUMENT_WORKER_SECRET") or os.getenv("FILE_SCAN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="PROCESSOR_SECRET_NOT_CONFIGURED")
    supplied = (value or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")


@app.middleware("http")
async def harden_requests(request: Request, call_next):
    trace_id = request.headers.get("x-trace-id") or f"ptr_{uuid.uuid4().hex}"
    request.state.trace_id = trace_id
    max_bytes = int(os.getenv("MAX_PROCESSOR_REQUEST_BYTES", str(4 * 1024 * 1024)))
    declared = int(request.headers.get("content-length", "0") or 0)
    if declared > max_bytes:
        return JSONResponse({"detail": "REQUEST_BODY_TOO_LARGE", "traceId": trace_id}, status_code=413, headers={"x-trace-id": trace_id})
    started = time.monotonic()
    response = await call_next(request)
    response.headers["x-trace-id"] = trace_id
    response.headers["cache-control"] = "no-store"
    logger.info("processor_request path=%s status=%s duration_ms=%s trace_id=%s", request.url.path, response.status_code, round((time.monotonic() - started) * 1000), trace_id)
    return response


@app.get("/health")
def health():
    return {"status": "ok", "version": "4.13.7", "clamav": bool(os.getenv("CLAMAV_HOST")), "limits": {"maxSourceBytes": int(os.getenv("MAX_PROCESSOR_SOURCE_BYTES", str(300 * 1024 * 1024)))}}


@app.post("/process")
def process(request: ProcessRequest, http_request: Request, authorization: str | None = Header(default=None)):
    authorize(authorization)
    allowed = {"pdf_import", "pdf_reconstruct", "docx_import", "ocr", "thumbnail", "pdf_export", "health_scan"}
    if request.type not in allowed:
        raise HTTPException(status_code=400, detail="UNSUPPORTED_JOB_TYPE")
    if len(request.input) > int(os.getenv("MAX_PROCESSOR_INPUT_KEYS", "200")):
        raise HTTPException(status_code=413, detail="PROCESSOR_INPUT_TOO_LARGE")
    try:
        result = process_job(request.type, request.organizationId, request.jobId, request.input)
        return {"ok": True, "result": result, "traceId": http_request.state.trace_id}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("processing_failed job_id=%s type=%s trace_id=%s", request.jobId, request.type, http_request.state.trace_id)
        detail = "PROCESSING_FAILED" if os.getenv("DEBUG_PROCESSOR_ERRORS", "false").lower() != "true" else f"PROCESSING_FAILED: {type(error).__name__}"
        raise HTTPException(status_code=500, detail=detail) from error


@app.post("/scan")
def scan(request: ScanRequest, http_request: Request, authorization: str | None = Header(default=None)):
    authorize(authorization)
    try:
        return {**scan_url(request.downloadUrl, request.mimeType), "traceId": http_request.state.trace_id}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("scan_failed file_name=%s trace_id=%s", request.fileName, http_request.state.trace_id)
        raise HTTPException(status_code=500, detail="SCAN_FAILED") from error
