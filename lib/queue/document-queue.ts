import { getAppMode } from "@/lib/runtime-config";
import { computeRetryDelayMs, getInputRuntimePolicy, type InputFormat, type InputMode } from "@h2obook/input-core";

export type DocumentJobType = "pdf_import" | "pdf_reconstruct" | "docx_import" | "ocr" | "thumbnail" | "pdf_export" | "health_scan";
export type DocumentJob = {
  id: string;
  organizationId: string;
  type: DocumentJobType;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const memoryJobs = new Map<string, DocumentJob>();

function safeJobId(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
  return safe || crypto.randomUUID();
}

function jobPolicy(input: Omit<DocumentJob, "id" | "status" | "progress" | "createdAt" | "updatedAt">) {
  const format = String(input.input.format ?? (input.type.startsWith("pdf") ? "pdf" : input.type === "docx_import" ? "docx" : input.type === "ocr" ? "png" : "txt")) as InputFormat;
  const mode = String(input.input.mode ?? (input.type === "pdf_import" ? "fixed_layout" : input.type === "ocr" ? "ocr" : "editable_content")) as InputMode;
  return getInputRuntimePolicy(format, mode);
}

async function redisConnection() {
  const IORedisModule = await import("ioredis");
  return new IORedisModule.default(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 10_000),
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 15_000),
  });
}

export async function enqueueDocumentJob(input: Omit<DocumentJob, "id" | "status" | "progress" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const requestedJobId = safeJobId(input.input.idempotencyKey ?? input.input.databaseJobId ?? input.input.inputSessionId);
  const fallback: DocumentJob = { ...input, id: requestedJobId, status: "queued", progress: 0, createdAt: now, updatedAt: now };
  if (!process.env.REDIS_URL) {
    if (getAppMode() === "production") throw new Error("REDIS_NOT_CONFIGURED");
    const existing = memoryJobs.get(requestedJobId);
    if (existing) return existing;
    memoryJobs.set(fallback.id, fallback);
    setTimeout(() => {
      const job = memoryJobs.get(fallback.id);
      if (!job || job.status === "cancelled") return;
      memoryJobs.set(job.id, { ...job, status: "completed", progress: 100, output: { mode: "demo", message: "Job hoàn tất trong bộ xử lý local." }, updatedAt: new Date().toISOString() });
    }, 900);
    return fallback;
  }
  const [{ Queue }] = await Promise.all([import("bullmq")]);
  const connection = await redisConnection();
  const queue = new Queue("h2obook-document", { connection });
  const policy = jobPolicy(input);
  const attempts = Math.min(policy.maxAttempts, Math.max(1, Number(process.env.DOCUMENT_JOB_ATTEMPTS ?? 3)));
  try {
    const existing = await queue.getJob(requestedJobId);
    if (existing) return { ...fallback, id: String(existing.id) };
    const job = await queue.add(input.type, input, {
      jobId: requestedJobId,
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 },
      attempts,
      backoff: { type: "exponential", delay: computeRetryDelayMs(0, { random: 0.5 }) },
    });
    return { ...fallback, id: String(job.id) };
  } finally { await queue.close(); await connection.quit(); }
}

export async function getDocumentJob(id: string): Promise<DocumentJob | null> {
  if (!process.env.REDIS_URL) return memoryJobs.get(id) ?? null;
  const [{ Queue }] = await Promise.all([import("bullmq")]);
  const connection = await redisConnection();
  const queue = new Queue("h2obook-document", { connection });
  try {
    const job = await queue.getJob(id);
    if (!job) return null;
    const state = await job.getState();
    const progress = typeof job.progress === "number" ? job.progress : Number((job.progress as { percent?: number })?.percent ?? 0);
    return {
      id: String(job.id), organizationId: String(job.data.organizationId ?? ""), type: job.name as DocumentJobType,
      status: state === "active" ? "processing" : state === "waiting" || state === "delayed" ? "queued" : state === "completed" ? "completed" : state === "failed" ? "failed" : "cancelled",
      progress, input: job.data.input ?? job.data, output: job.returnvalue, error: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(), updatedAt: new Date(job.processedOn ?? job.finishedOn ?? job.timestamp).toISOString()
    };
  } finally { await queue.close(); await connection.quit(); }
}

export function listMemoryJobs() { return [...memoryJobs.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }

export async function listDocumentJobs(): Promise<DocumentJob[]> {
  if (!process.env.REDIS_URL) return listMemoryJobs();
  const [{ Queue }] = await Promise.all([import("bullmq")]);
  const connection = await redisConnection();
  const queue = new Queue("h2obook-document", { connection });
  try {
    const jobs = await queue.getJobs(["waiting", "active", "completed", "failed", "delayed"], 0, 99, true);
    const results: DocumentJob[] = [];
    for (const job of jobs) {
      const state = await job.getState();
      const progress = typeof job.progress === "number" ? job.progress : Number((job.progress as { percent?: number })?.percent ?? 0);
      results.push({
        id: String(job.id), organizationId: String(job.data.organizationId ?? ""), type: job.name as DocumentJobType,
        status: state === "active" ? "processing" : state === "waiting" || state === "delayed" ? "queued" : state === "completed" ? "completed" : state === "failed" ? "failed" : "cancelled",
        progress, input: job.data.input ?? job.data, output: job.returnvalue, error: job.failedReason,
        createdAt: new Date(job.timestamp).toISOString(), updatedAt: new Date(job.processedOn ?? job.finishedOn ?? job.timestamp).toISOString()
      });
    }
    return results.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  } finally { await queue.close(); await connection.quit(); }
}

export async function cancelDocumentJob(id: string): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    const job = memoryJobs.get(id);
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) return false;
    memoryJobs.set(id, { ...job, status: "cancelled", updatedAt: new Date().toISOString() });
    return true;
  }
  const [{ Queue }] = await Promise.all([import("bullmq")]);
  const connection = await redisConnection();
  const queue = new Queue("h2obook-document", { connection });
  try {
    const job = await queue.getJob(id);
    if (!job) return false;
    const state = await job.getState();
    if (["waiting", "delayed", "paused"].includes(state)) { await job.remove(); return true; }
    if (state === "active") {
      await job.updateData({ ...job.data, cancellationRequested: true });
      return true;
    }
    return false;
  } finally { await queue.close(); await connection.quit(); }
}
