import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, requestIdentity } from "@/lib/security/rate-limit";

// Fallback tier only (H2O Brain Assistant §12): keyword search over knowledge_chunks via the
// learning_match_knowledge_chunks RPC, which itself re-checks entitlement with
// has_space_entitlement() before returning any row. This works with zero AI provider configured.
// The AI/RAG tier (embeddings, citations, provider abstraction) is intentionally deferred — see
// the integration report — and must never bypass this same entitlement gate when it lands.
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const limit = await rateLimit(requestIdentity(request, `brain-assistant:${auth.user!.id}`), 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = await request.json().catch(() => null) as { spaceId?: string; query?: string } | null;
  const query = body?.query?.trim();
  if (!body?.spaceId || !query || query.length < 2) return NextResponse.json({ error: "SPACE_ID_AND_QUERY_REQUIRED" }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });

  const { data, error } = await supabase.rpc("learning_match_knowledge_chunks", { p_space_id: body.spaceId, p_query: query, p_limit: 6 });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const matches = (data ?? []) as { chunk_id: string; block_id: string | null; chunk_label: string; search_text: string; rank: number }[];

  if (!matches.length) {
    return NextResponse.json({
      answer: "Mình chưa tìm thấy nội dung phù hợp trong Knowledge Space này cho câu hỏi đó. Bạn thử hỏi cụ thể hơn, hoặc dùng nút Hỏi giảng viên nhé.",
      citations: [],
      tier: "fallback"
    });
  }

  const answer = `Mình tìm thấy ${matches.length} phần liên quan trong bài học:\n\n` + matches.map((match, index) => `${index + 1}. ${match.chunk_label || "Nội dung"}: ${match.search_text.slice(0, 220)}${match.search_text.length > 220 ? "…" : ""}`).join("\n\n");
  return NextResponse.json({
    answer,
    citations: matches.map((match) => ({ label: match.chunk_label || "Nội dung", blockId: match.block_id })),
    tier: "fallback"
  });
}
