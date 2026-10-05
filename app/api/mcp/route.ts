import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Cổng MCP chuẩn H2O — Joyce OS kết nối qua đây.
// Transport: POST JSON-RPC 2.0 (initialize / notifications/initialized /
//            tools/list / tools/call)
// Xác thực: Authorization: Bearer <H2O_MCP_TOKEN>
// Chỉ phơi tool ĐỌC — không tool nào ghi/xoá dữ liệu.
// ---------------------------------------------------------------------------

const SERVER = { name: "h2obook", version: "1.0.0" };
const PROTOCOL = "2025-06-18";

function checkAuth(req: Request): Response | null {
  const token = process.env.H2O_MCP_TOKEN || "";
  if (!token) {
    return Response.json({ error: "H2O_MCP_TOKEN chưa cấu hình trên server." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "Sai hoặc thiếu Bearer token." }, { status: 401 });
  }
  return null;
}

type Args = Record<string, unknown>;
type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (a: Args) => Promise<unknown>;
};

const lim = (a: Args, def = 20, max = 50) => {
  const n = Number(a.limit);
  return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : def;
};

// Đếm rows của một bảng. Bảng không tồn tại (migration chưa chạy) → trả null
// thay vì làm cả tool lỗi.
async function count(sb: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, table: string): Promise<number | null> {
  const { count: c, error } = await sb.from(table).select("*", { count: "exact", head: true });
  return error ? null : (c ?? 0);
}

const TOOLS: ToolDef[] = [
  {
    name: "book_health",
    description: "Sức khoẻ app + tổng số sách / khoá học / lớp / học viên.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const sb = createSupabaseAdminClient();
      if (!sb) return { ok: false, error: "Supabase chưa cấu hình." };
      return {
        ok: true,
        app: "h2obook",
        totals: {
          books: await count(sb, "books"),
          academyCourses: await count(sb, "academy_courses"),
          classes: await count(sb, "classes"),
          classMembers: await count(sb, "class_members"),
          profiles: await count(sb, "profiles"),
        },
      };
    },
  },
  {
    name: "book_report",
    description: "Báo cáo vận hành: missions theo trạng thái, học viên mới 7 ngày, nội dung mới 7 ngày.",
    inputSchema: { type: "object", properties: {} },
    async run() {
      const sb = createSupabaseAdminClient();
      if (!sb) return { ok: false, error: "Supabase chưa cấu hình." };
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: missions } = await sb.from("student_mission_states").select("status");
      const byStatus: Record<string, number> = {};
      for (const m of missions || []) byStatus[m.status || "unknown"] = (byStatus[m.status || "unknown"] || 0) + 1;
      const { count: newMembers } = await sb.from("class_members")
        .select("*", { count: "exact", head: true }).gte("created_at", since);
      const { count: newBooks } = await sb.from("books")
        .select("*", { count: "exact", head: true }).gte("created_at", since);
      return {
        missionsByStatus: byStatus,
        newClassMembers7d: newMembers ?? 0,
        newBooks7d: newBooks ?? 0,
        totals: {
          academyCourses: await count(sb, "academy_courses"),
          classes: await count(sb, "classes"),
        },
      };
    },
  },
  {
    name: "book_list_courses",
    description: "Khoá học academy gần nhất. Args: limit.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
    async run(a) {
      const sb = createSupabaseAdminClient();
      if (!sb) return { error: "Supabase chưa cấu hình." };
      const { data, error } = await sb.from("academy_courses")
        .select("id, title, slug, status, created_at, updated_at")
        .order("updated_at", { ascending: false }).limit(lim(a));
      return error ? { error: error.message } : data;
    },
  },
  {
    name: "book_list_books",
    description: "Sách gần nhất trong hệ thống. Args: limit.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
    async run(a) {
      const sb = createSupabaseAdminClient();
      if (!sb) return { error: "Supabase chưa cấu hình." };
      const { data, error } = await sb.from("books")
        .select("id, title, status, created_at, updated_at")
        .order("updated_at", { ascending: false }).limit(lim(a));
      return error ? { error: error.message } : data;
    },
  },
  {
    name: "book_list_classes",
    description: "Lớp học đang mở. Args: limit.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } },
    async run(a) {
      const sb = createSupabaseAdminClient();
      if (!sb) return { error: "Supabase chưa cấu hình." };
      const { data, error } = await sb.from("classes")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false }).limit(lim(a));
      return error ? { error: error.message } : data;
    },
  },
];

const TOOL_INDEX = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Args } };
  try {
    msg = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON không hợp lệ." } });
  }

  const id = msg.id ?? null;
  const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
  const rpcErr = (code: number, m: string) => Response.json({ jsonrpc: "2.0", id, error: { code, message: m } });

  switch (msg.method) {
    case "initialize":
      return reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER });
    case "notifications/initialized":
    case "initialized":
      return new Response(null, { status: 202 });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    case "tools/call": {
      const name = String(msg.params?.name || "");
      const tool = TOOL_INDEX[name];
      if (!tool) return rpcErr(-32602, `Không có tool "${name}".`);
      try {
        const data = await tool.run(msg.params?.arguments || {});
        return reply({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
      } catch (e) {
        return reply({
          content: [{ type: "text", text: `Lỗi: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcErr(-32601, `Method "${msg.method}" không hỗ trợ.`);
  }
}
