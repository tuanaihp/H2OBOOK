import { createDownloadUrl } from "@/lib/storage/r2";

export type ScanResult = { status: "clean" | "blocked" | "pending"; reason?: string };

export function isFileScannerConfigured() {
  return Boolean(process.env.FILE_SCAN_URL);
}

export async function scanStoredFile(input: { key: string; fileName: string; mimeType: string; sizeBytes: number }): Promise<ScanResult> {
  if (!process.env.FILE_SCAN_URL) return { status: "pending", reason: "FILE_SCAN_URL_NOT_CONFIGURED" };
  const downloadUrl = await createDownloadUrl(input.key, input.fileName);
  try {
    const response = await fetch(process.env.FILE_SCAN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.FILE_SCAN_TOKEN ? { authorization: `Bearer ${process.env.FILE_SCAN_TOKEN}` } : {})
      },
      body: JSON.stringify({ ...input, downloadUrl }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) return { status: "pending", reason: `SCANNER_HTTP_${response.status}` };
    const data = await response.json() as { status?: string; clean?: boolean; reason?: string };
    if (data.status === "blocked" || data.clean === false) return { status: "blocked", reason: data.reason ?? "MALWARE_OR_POLICY_BLOCK" };
    if (data.status === "clean" || data.clean === true) return { status: "clean" };
    return { status: "pending", reason: data.reason ?? "SCANNER_UNDECIDED" };
  } catch (error) {
    return { status: "pending", reason: error instanceof Error ? error.message : "SCANNER_FAILED" };
  }
}
