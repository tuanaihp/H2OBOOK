"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Sparkles, RefreshCw } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { RULE_FIELDS, RULE_OPERATORS, type RuleField, type RuleOperator } from "@/lib/brain/types";
import styles from "@/components/operations/operations.module.css";

type Candidate = { assetId: string; title: string; originalName: string; mimeType: string; assetSubtype: string | null; folderId: string | null };
type InboxItem = {
  id: string; assetId: string | null; title: string; status: string; createdAt: string;
  candidate: Candidate | null;
  suggestion: { id: string; source: string; stageId: string | null; nodeId: string | null; surface: string | null; confidence: number; reason: string; decision: string } | null;
};
type Stage = { id: string; title: string; indexLabel: string; position: number };
type Node = { id: string; parentId: string | null; nodeType: string; title: string; position: number };
type Rule = { id: string; name: string; enabled: boolean; priority: number; conditions: { field: string; operator: string; value: string }[]; actions: { stageId?: string; nodeId?: string; surface?: string } };
type AiStatus = { configured: boolean; provider: string | null; model: string | null };

const field = { padding: 10, borderRadius: 10, border: "1px solid #dfe3e8", fontSize: 12 } as const;
const SURFACE_LABEL: Record<string, string> = { learn: "Learn", create: "Create", business: "Business", coaching: "H2O Coaching" };
const SOURCE_LABEL: Record<string, string> = { rule: "Theo luật", memory: "Theo tiền lệ", manual: "Cần chọn tay", ai: "AI" };
const FIELD_LABEL: Record<RuleField, string> = { title: "Tiêu đề", originalName: "Tên file gốc", mimeType: "Loại MIME", assetSubtype: "Phân loại con", folderId: "Thư mục (id)" };
const OPERATOR_LABEL: Record<RuleOperator, string> = { contains: "chứa", equals: "bằng đúng", startsWith: "bắt đầu bằng", endsWith: "kết thúc bằng" };

export default function BrainCuratorPage() {
  const [tab, setTab] = useState<"queue" | "rules">("queue");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [nodesByStage, setNodesByStage] = useState<Record<string, Node[]>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Three requests, not one per review card. The stage list, every stage's tree and the AI status
  // all arrive together; previously each card independently fetched the tree for the stage its
  // suggestion named, so ten cards could fire ten overlapping requests for the same stage.
  async function load() {
    setLoading(true);
    const [inboxRes, stagesRes, rulesRes] = await Promise.all([
      fetch("/api/academy-admin/brain/inbox", { cache: "no-store" }),
      fetch("/api/academy-admin/stages?nodes=1", { cache: "no-store" }),
      fetch("/api/academy-admin/brain/rules", { cache: "no-store" })
    ]);
    const inboxJson = await inboxRes.json().catch(() => null);
    const stagesJson = await stagesRes.json().catch(() => null);
    const rulesJson = await rulesRes.json().catch(() => null);
    if (inboxRes.ok) { setItems(inboxJson?.items ?? []); setAi(inboxJson?.ai ?? null); }
    if (stagesRes.ok) { setStages(stagesJson?.stages ?? []); setNodesByStage(stagesJson?.nodes ?? {}); }
    if (rulesRes.ok) setRules(rulesJson?.items ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function call(url: string, init: RequestInit, okMessage: string) {
    setBusy(true); setMessage(null);
    const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { setMessage(json?.error ?? "Thao tác thất bại."); return false; }
    setMessage(okMessage);
    await load();
    return true;
  }

  const pending = items.filter((item) => item.status === "review");
  const decided = items.filter((item) => item.status !== "review");

  return <SimpleOperationsShell title="Academy Control Center" subtitle="H2O Brain" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>H2O BRAIN · HÀNG ĐỢI DUYỆT</span>
        <h1>Từ kho tài sản vào lộ trình</h1>
        <p>
          Đưa tài sản vào hàng đợi, hệ thống đề xuất chỗ đặt theo thứ tự: <strong>luật bạn tự viết</strong> → <strong>tiền lệ bạn đã duyệt</strong> → <strong>AI</strong> (chỉ khi hai cái trước không xử lý được).
          Bạn xem lại rồi mới duyệt vào lộ trình học viên.
        </p>
        {ai && <p style={{ margin: "8px 0 0", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: ai.configured ? "#ecfeff" : "#f1f5f9", color: ai.configured ? "#0e7490" : "#64748b" }}>
          <Sparkles size={12} />
          {ai.configured ? `AI đang bật · ${ai.provider} · ${ai.model}` : "AI chưa cấu hình — chỉ dùng luật và tiền lệ"}
        </p>}
      </div>
      <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setPickerOpen(true)}><Plus size={14} />Đưa tài sản vào hàng đợi</button>
    </header>

    {message && <p style={{ fontSize: 12, marginBottom: 14, color: message.startsWith("Đã") ? "#177a54" : "#b22949" }}>{message}</p>}

    <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #eef1f4", paddingBottom: 8, marginBottom: 18 }}>
      {([["queue", `Hàng đợi (${pending.length})`], ["rules", `Luật phân loại (${rules.length})`]] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)}
        style={{ padding: "8px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: tab === key ? "#0f172a" : "#f1f5f9", color: tab === key ? "#fff" : "#334155" }}>
        {label}
      </button>)}
    </div>

    {loading && <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p>}

    {!loading && tab === "queue" && <div style={{ display: "grid", gap: 12 }}>
      {pending.length === 0 && <div className={styles.card} style={{ padding: 24, textAlign: "center", color: "#6b7a89" }}>
        Hàng đợi trống. Bấm &quot;Đưa tài sản vào hàng đợi&quot; để bắt đầu.
      </div>}
      {pending.map((item) => <ReviewCard key={item.id} item={item} stages={stages} nodesByStage={nodesByStage} busy={busy}
        onReanalyze={() => call("/api/academy-admin/brain/analyze", { method: "POST", body: JSON.stringify({ itemIds: [item.id] }) }, "Đã phân tích lại.")}
        onApprove={(payload) => call(`/api/academy-admin/brain/suggestions/${item.suggestion?.id}/approve`, { method: "POST", body: JSON.stringify(payload) }, "Đã duyệt và gắn vào lộ trình.")}
        onReject={() => call(`/api/academy-admin/brain/suggestions/${item.suggestion?.id}/reject`, { method: "POST", body: "{}" }, "Đã từ chối.")}
        onRemove={() => { if (confirm("Bỏ khỏi hàng đợi? Tài sản gốc không bị xóa.")) call(`/api/academy-admin/brain/inbox/${item.id}`, { method: "DELETE" }, "Đã bỏ khỏi hàng đợi."); }} />)}

      {decided.length > 0 && <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, color: "#6b7a89" }}>Đã xử lý ({decided.length})</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {decided.map((item) => <div key={item.id} className={styles.card} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <span>{item.title}</span>
            <span style={{ color: item.status === "approved" ? "#177a54" : "#b22949" }}>{item.status === "approved" ? "Đã duyệt" : "Đã từ chối"}</span>
          </div>)}
        </div>
      </details>}
    </div>}

    {!loading && tab === "rules" && <RulesTab rules={rules} stages={stages} busy={busy}
      onCreate={(payload) => call("/api/academy-admin/brain/rules", { method: "POST", body: JSON.stringify(payload) }, "Đã thêm luật.")}
      onToggle={(ruleId, enabled) => call(`/api/academy-admin/brain/rules/${ruleId}`, { method: "PATCH", body: JSON.stringify({ enabled }) }, "Đã cập nhật luật.")}
      onDelete={(ruleId) => call(`/api/academy-admin/brain/rules/${ruleId}`, { method: "DELETE" }, "Đã xóa luật.")} />}

    {pickerOpen && <CandidatePicker busy={busy} onClose={() => setPickerOpen(false)}
      onEnqueue={async (assetIds) => { if (await call("/api/academy-admin/brain/inbox", { method: "POST", body: JSON.stringify({ assetIds }) }, "Đã đưa vào hàng đợi.")) setPickerOpen(false); }} />}
  </SimpleOperationsShell>;
}

function ReviewCard({ item, stages, nodesByStage, busy, onReanalyze, onApprove, onReject, onRemove }: {
  item: InboxItem; stages: Stage[]; nodesByStage: Record<string, Node[]>; busy: boolean;
  onReanalyze: () => Promise<boolean>;
  onApprove: (payload: Record<string, unknown>) => Promise<boolean>;
  onReject: () => Promise<boolean>;
  onRemove: () => void;
}) {
  const [stageId, setStageId] = useState(item.suggestion?.stageId ?? "");
  const [nodeId, setNodeId] = useState(item.suggestion?.nodeId ?? "");
  const [surface, setSurface] = useState(item.suggestion?.surface ?? "");
  const nodes = nodesByStage[stageId] ?? [];
  const suggestion = item.suggestion;
  const confidencePercent = suggestion ? Math.round(suggestion.confidence * 100) : 0;

  return <div className={styles.card} style={{ padding: 16, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {item.candidate?.originalName}{item.candidate?.mimeType ? ` · ${item.candidate.mimeType}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {suggestion && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: suggestion.source === "rule" ? "#ecfeff" : suggestion.source === "memory" ? "#f5f3ff" : "#fffbeb", color: suggestion.source === "rule" ? "#0e7490" : suggestion.source === "memory" ? "#6d28d9" : "#b45309" }}>
          {SOURCE_LABEL[suggestion.source] ?? suggestion.source}{confidencePercent > 0 ? ` · ${confidencePercent}%` : ""}
        </span>}
        <button className={styles.button} disabled={busy} title="Bỏ khỏi hàng đợi" onClick={onRemove}><Trash2 size={12} /></button>
      </div>
    </div>

    {suggestion?.reason && <p style={{ margin: 0, fontSize: 12, color: "#6b7a89", background: "#f8fafc", padding: "8px 10px", borderRadius: 10 }}>{suggestion.reason}</p>}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giai đoạn
        <select value={stageId} style={field} onChange={(event) => { setStageId(event.target.value); setNodeId(""); }}>
          <option value="">— Chọn giai đoạn —</option>
          {stages.slice().sort((a, b) => a.position - b.position).map((stage) => <option key={stage.id} value={stage.id}>{stage.indexLabel || stage.position + 1}. {stage.title}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Chương trình / học phần
        <select value={nodeId} style={field} disabled={!stageId} onChange={(event) => setNodeId(event.target.value)}>
          <option value="">— Chưa phân loại —</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.nodeType === "module" ? "— " : node.nodeType === "group" ? "—— " : ""}{node.title}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Khu vực học viên
        <select value={surface} style={field} onChange={(event) => setSurface(event.target.value)}>
          <option value="">— Kế thừa —</option>
          {Object.entries(SURFACE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !stageId || !suggestion}
        onClick={() => onApprove({ stageId, nodeId: nodeId || null, surface: surface || null })}><Check size={13} />Duyệt vào lộ trình</button>
      <button className={styles.button} disabled={busy || !suggestion} onClick={onReject}><X size={13} />Từ chối</button>
      <button className={styles.button} disabled={busy} title="Chạy lại luật, tiền lệ và AI cho mục này" onClick={onReanalyze}><RefreshCw size={13} />Phân tích lại</button>
    </div>
  </div>;
}

function RulesTab({ rules, stages, busy, onCreate, onToggle, onDelete }: {
  rules: Rule[]; stages: Stage[]; busy: boolean;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onToggle: (ruleId: string, enabled: boolean) => Promise<boolean>;
  onDelete: (ruleId: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [ruleField, setRuleField] = useState<RuleField>("originalName");
  const [operator, setOperator] = useState<RuleOperator>("contains");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState("");
  const [surface, setSurface] = useState("");
  const [priority, setPriority] = useState(100);

  return <div style={{ display: "grid", gap: 14 }}>
    <div className={styles.card} style={{ padding: 18 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Luật phân loại</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6b7a89" }}>
        Số ưu tiên nhỏ hơn thì thắng khi hai luật cùng chỉ định một trường. Luật không có điều kiện nào sẽ <strong>không khớp gì cả</strong> — cố ý như vậy, để một luật viết dở không quét trúng mọi tài liệu.
      </p>
      {rules.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có luật nào. Chưa có luật thì hệ thống vẫn đề xuất được dựa trên những gì bạn đã duyệt trước đó.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {rules.map((rule) => {
          const stage = stages.find((candidate) => candidate.id === rule.actions.stageId);
          return <div key={rule.id} style={{ border: "1px solid #eef1f4", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", opacity: rule.enabled ? 1 : 0.55 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{rule.name} <span style={{ fontSize: 10, color: "#94a3b8" }}>#{rule.priority}</span></div>
              <div style={{ fontSize: 11, color: "#6b7a89", marginTop: 2 }}>
                {rule.conditions.map((condition) => `${FIELD_LABEL[condition.field as RuleField] ?? condition.field} ${OPERATOR_LABEL[condition.operator as RuleOperator] ?? condition.operator} “${condition.value}”`).join(" và ")}
                {" → "}
                {stage ? stage.title : rule.actions.stageId ? "giai đoạn đã xóa" : "không đổi giai đoạn"}
                {rule.actions.surface ? ` · ${SURFACE_LABEL[rule.actions.surface]}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <input type="checkbox" checked={rule.enabled} disabled={busy} onChange={(event) => onToggle(rule.id, event.target.checked)} />Bật
              </label>
              <button className={styles.button} disabled={busy} onClick={() => { if (confirm(`Xóa luật “${rule.name}”?`)) onDelete(rule.id); }}><Trash2 size={12} /></button>
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className={styles.card} style={{ padding: 18 }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 15 }}>Thêm luật</h2>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 100px", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên luật<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Video makeup → Giai đoạn 1" style={field} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Ưu tiên<input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} style={field} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.4fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Nếu
            <select value={ruleField} style={field} onChange={(event) => setRuleField(event.target.value as RuleField)}>
              {RULE_FIELDS.map((item) => <option key={item} value={item}>{FIELD_LABEL[item]}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Điều kiện
            <select value={operator} style={field} onChange={(event) => setOperator(event.target.value as RuleOperator)}>
              {RULE_OPERATORS.map((item) => <option key={item} value={item}>{OPERATOR_LABEL[item]}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giá trị<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="makeup" style={field} /></label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Thì xếp vào giai đoạn
            <select value={stageId} style={field} onChange={(event) => setStageId(event.target.value)}>
              <option value="">— Chọn giai đoạn —</option>
              {stages.slice().sort((a, b) => a.position - b.position).map((stage) => <option key={stage.id} value={stage.id}>{stage.indexLabel || stage.position + 1}. {stage.title}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Khu vực (tùy chọn)
            <select value={surface} style={field} onChange={(event) => setSurface(event.target.value)}>
              <option value="">— Không đặt —</option>
              {Object.entries(SURFACE_LABEL).map(([item, label]) => <option key={item} value={item}>{label}</option>)}
            </select>
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !name.trim() || !value.trim() || (!stageId && !surface)} onClick={async () => {
            if (await onCreate({ name, priority, conditions: [{ field: ruleField, operator, value }], actions: { stageId: stageId || undefined, surface: surface || undefined } })) {
              setName(""); setValue(""); setStageId(""); setSurface("");
            }
          }}><Plus size={14} />Thêm luật</button>
        </div>
      </div>
    </div>
  </div>;
}

function CandidatePicker({ busy, onClose, onEnqueue }: { busy: boolean; onClose: () => void; onEnqueue: (assetIds: string[]) => Promise<void> }) {
  const [items, setItems] = useState<Candidate[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function search() {
    setLoading(true);
    const url = new URL("/api/academy-admin/brain/candidates", window.location.origin);
    if (q.trim()) url.searchParams.set("q", q.trim());
    const res = await fetch(url.toString().replace(window.location.origin, ""), { cache: "no-store" });
    const json = await res.json().catch(() => null);
    setItems(json?.items ?? []);
    setLoading(false);
  }
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(assetId: string) {
    setSelected((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  }

  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
    <div style={{ background: "#fff", width: "min(560px, 100%)", height: "100%", overflowY: "auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a21caf", textTransform: "uppercase" }}>Kho tài sản</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Chọn tài sản đưa vào hàng đợi</h2>
          <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 4 }}>Tài sản đã nằm trong hàng đợi không hiện ở đây.</p>
        </div>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 16 }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tìm theo tên…" style={field} />
        <button className={styles.button} onClick={search}>Tìm</button>
      </div>
      {loading && <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 12 }}>Đang tải…</p>}
      {!loading && items.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89", marginTop: 12 }}>Không còn tài sản nào để đưa vào hàng đợi.</p>}
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        {items.map((item) => <label key={item.assetId} style={{ display: "flex", gap: 10, alignItems: "center", border: selected.includes(item.assetId) ? "2px solid #22d3ee" : "1px solid #eef1f4", borderRadius: 12, padding: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={selected.includes(item.assetId)} onChange={() => toggle(item.assetId)} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title || item.originalName}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.originalName}{item.mimeType ? ` · ${item.mimeType}` : ""}</div>
          </div>
        </label>)}
      </div>
      <div style={{ position: "sticky", bottom: 0, background: "#fff", paddingTop: 14, marginTop: 14, borderTop: "1px solid #eef1f4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6b7a89" }}>{selected.length} đã chọn</span>
        <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={busy || !selected.length} onClick={() => onEnqueue(selected)}>Đưa vào hàng đợi</button>
      </div>
    </div>
  </div>;
}
