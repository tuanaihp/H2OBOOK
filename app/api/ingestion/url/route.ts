import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { safeFetchDocument } from "@/lib/ingestion/safe-fetch";
import { parseHtmlImport } from "@/lib/input/html-import.server";
import { previewIngestion, type IngestionSourceType } from "@h2obook/ingestion-core";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limited = await rateLimit(requestIdentity(request, "ingestion-url"), 20, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { url?: string; organizationId?: string; bookId?: string } | null;
  if (!body?.url) return NextResponse.json({ error: "URL_REQUIRED" }, { status: 400 });
  try {
    const fetched = await safeFetchDocument(body.url);
    const rss = /rss|xml/.test(fetched.contentType) && /<(?:rss|feed)[\s>]/i.test(fetched.body);
    const host = new URL(fetched.url).hostname;
    if (rss) {
      const sourceType: IngestionSourceType = "podcast_rss";
      const preview = previewIngestion({ type: sourceType, title: fetched.title, content: fetched.body, sourceUrl: fetched.url });
      return NextResponse.json({ preview, raw: { url: fetched.url, contentType: fetched.contentType }, parser: "rss-rule-based" });
    }
    if (!["text/html", "application/xhtml+xml"].includes(fetched.contentType)) {
      const sourceType: IngestionSourceType = fetched.contentType === "text/markdown" ? "markdown" : "plain_text";
      const preview = previewIngestion({ type: sourceType, title: fetched.title, content: fetched.body, sourceUrl: fetched.url });
      return NextResponse.json({ preview, raw: { url: fetched.url, contentType: fetched.contentType }, parser: "plain-text" });
    }
    const access = body.organizationId ? await resolveOrganizationAccess(auth.user!, body.organizationId) : null;
    const result = parseHtmlImport({
      html: fetched.body,
      sourceFileName: new URL(fetched.url).pathname.split("/").pop() || "web-page.html",
      title: fetched.title,
      bookId: body.bookId || crypto.randomUUID(),
      organizationId: access?.organizationId,
      sourceUrl: body.url,
      finalUrl: fetched.url,
      contentType: fetched.contentType,
      charset: fetched.charset,
    });
    const preview = {
      title: result.title,
      sourceType: host === "docs.google.com" ? "google_docs" : host.includes("notion") ? "notion" : "url",
      nodes: result.nodes,
      warnings: result.warnings.map(({ code, message, severity }) => ({ code, message, severity })),
      statistics: {
        chapters: result.nodes.filter((node) => node.type === "chapter").length,
        headings: result.statistics.headings,
        paragraphs: result.statistics.paragraphs,
        lists: result.statistics.lists,
        words: result.statistics.words,
      },
      metadata: result.metadata,
    };
    return NextResponse.json({ preview, result, raw: { url: fetched.url, contentType: fetched.contentType }, parser: "jsdom-dom-2.0" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INGESTION_FAILED" }, { status: 400 });
  }
}
