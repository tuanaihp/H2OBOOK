"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { Bot, KeyRound, Plug, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

type ProviderKind = "gemini" | "openai" | "xai";
interface Credential {
  id: string; provider: ProviderKind; label: string; apiKeyLast4: string; capabilities: string[];
  status: "untested" | "connected" | "failed"; lastTestedAt: string | null; lastTestError: string | null; enabled: boolean;
}

const PROVIDERS: { value: ProviderKind; label: string; hint: string }[] = [
  { value: "gemini", label: "Google Gemini", hint: "Văn bản + tạo ảnh (Nano Banana). Cùng API key dùng cho H2O Brain/H2O Coach nếu bạn muốn thay biến môi trường GEMINI_API_KEY bằng key quản lý ở đây." },
  { value: "openai", label: "OpenAI (ChatGPT)", hint: "Văn bản + tạo ảnh. Chỉ nhận API key thật từ platform.openai.com — không hỗ trợ đăng nhập bằng tài khoản ChatGPT cá nhân (không phải cơ chế chính thức của OpenAI, rủi ro khoá tài khoản)." },
  { value: "xai", label: "xAI (Grok)", hint: "Văn bản, tương thích API dạng OpenAI." }
];
const CAPABILITIES = [
  { key: "text", label: "Văn bản / Chat" },
  { key: "image", label: "Tạo ảnh" },
  { key: "document", label: "Tài liệu / OCR" }
];

const STATUS_LABEL: Record<Credential["status"], string> = { connected: "✓ Đã kết nối", failed: "✕ Lỗi kết nối", untested: "○ Chưa kiểm tra" };
const STATUS_TONE: Record<Credential["status"], string> = { connected: "#177a54", failed: "#b42318", untested: "#9aa4b2" };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; json: T & { error?: string } }> {
  const res = await fetch(url, init ? { ...init, headers: { "content-type": "application/json", ...init.headers } } : undefined);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

/**
 * "Cổng API" — organization-level AI provider credential vault. Reuses lib/enterprise/secret-box.ts's
 * exact AES-256-GCM mechanism already live for webhook secrets (migration 0018), not a new encryption
 * scheme. Connection test is a real lightweight "list models" call against each provider's own API —
 * never a fake status flip. No provider call is wired into an actual generation feature yet (see
 * docs/ai-provider-gateway-v1/FINAL_REPORT.md's scope note); this pass is the credential vault + a
 * verified-working connection, which is the real, honest first slice.
 */
export default function ApiGatewayPage() {
  const store = useAppStore();
  const organizationId = store.workspace.id;
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [provider, setProvider] = useState<ProviderKind>("gemini");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>(["text"]);
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Chưa có thay đổi");

  const load = useCallback(async () => {
    const { json } = await api<{ credentials: Credential[] }>(`/api/enterprise/ai-providers?organizationId=${organizationId}`);
    setCredentials(json.credentials ?? []);
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  function toggleCapability(key: string) {
    setCapabilities((v) => v.includes(key) ? v.filter((c) => c !== key) : [...v, key]);
  }

  async function createCredential() {
    if (!apiKey.trim()) { setStatus("Nhập API key trước đã."); return; }
    setBusy(true);
    const { ok, json } = await api("/api/enterprise/ai-providers", { method: "POST", body: JSON.stringify({ organizationId, provider, label, apiKey, capabilities }) });
    setBusy(false);
    if (!ok) { setStatus(json.error === "ENCRYPTION_KEY_NOT_CONFIGURED" ? "Chưa cấu hình ENCRYPTION_KEY trên server — không thể lưu key an toàn. Báo Admin hệ thống thêm biến môi trường này trước." : (json.error ?? "Không lưu được key")); return; }
    setLabel(""); setApiKey(""); setCapabilities(["text"]);
    setStatus("Đã lưu key. Bấm \"Kiểm tra kết nối\" để xác nhận key hoạt động thật.");
    await load();
  }

  async function testCredential(id: string) {
    setTestingId(id);
    const { ok, json } = await api<{ status: Credential["status"]; error: string | null }>(`/api/enterprise/ai-providers/${id}/test`, { method: "POST", body: JSON.stringify({ organizationId }) });
    setTestingId(null);
    if (!ok) { setStatus(json.error ?? "Không kiểm tra được kết nối"); return; }
    setStatus(json.status === "connected" ? "Kết nối thành công." : `Kết nối lỗi: ${json.error ?? "không rõ nguyên nhân"}`);
    await load();
  }

  async function removeCredential(id: string) {
    setBusy(true);
    await api(`/api/enterprise/ai-providers/${id}?organizationId=${organizationId}`, { method: "DELETE" });
    setBusy(false);
    setStatus("Đã xoá kết nối.");
    await load();
  }

  return <AppShell>
    <div className="page-header">
      <div><span className="eyebrow">AI PROVIDER GATEWAY</span><h1>Cổng API</h1><p>Kết nối và quản lý API key của các nhà cung cấp AI cho toàn tổ chức — mã hoá lưu trữ, không hiển thị lại key gốc.</p></div>
      <span className="core-status-pill"><ShieldCheck size={14} />Mã hoá AES-256-GCM</span>
    </div>

    <div className="enterprise-grid">
      <section className="section-card">
        <div className="section-head"><div><h2>Thêm kết nối mới</h2><p>Key được mã hoá ngay khi lưu — chỉ giải mã lúc thật sự gọi API.</p></div><KeyRound /></div>
        <label>Nhà cung cấp
          <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderKind)}>
            {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <p style={{ fontSize: 12, color: "#718092", margin: "4px 0 10px" }}>{PROVIDERS.find((p) => p.value === provider)?.hint}</p>
        <label>Tên gợi nhớ<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Production Gemini" /></label>
        <label>API key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Dán API key thật vào đây" /></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {CAPABILITIES.map((c) => <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid #dfe3e8", borderRadius: 999, padding: "4px 10px" }}>
            <input type="checkbox" checked={capabilities.includes(c.key)} onChange={() => toggleCapability(c.key)} />{c.label}
          </label>)}
        </div>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={createCredential}><Plug />Lưu kết nối</button>
      </section>

      <section className="section-card">
        <div className="section-head"><div><h2>Giới hạn hiện tại</h2><p>Trung thực về những gì chưa làm được.</p></div><Bot /></div>
        <div className="enterprise-capabilities">
          <span><Bot /><strong>Video</strong><small>Chưa có API công khai đơn giản cho Gemini/OpenAI/Grok — không làm giả nút không chạy được.</small></span>
          <span><ShieldCheck /><strong>Đăng nhập ChatGPT cá nhân</strong><small>Không hỗ trợ — không phải cơ chế chính thức của OpenAI.</small></span>
          <span><Plug /><strong>Chưa gắn vào tính năng tạo sinh</strong><small>Đợt này là kho lưu key + kiểm tra kết nối thật. Gắn vào tính năng cụ thể là bước kế tiếp.</small></span>
        </div>
      </section>
    </div>

    <section className="section-card" style={{ marginTop: 16 }}>
      <div className="section-head"><div><h2>Các kết nối đã lưu</h2><p>Key gốc không bao giờ hiển thị lại — chỉ 4 ký tự cuối.</p></div>
        <button className="btn" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>
      {credentials === null && <p>Đang tải…</p>}
      {credentials && credentials.length === 0 && <p style={{ color: "#718092", fontSize: 13 }}>Chưa có kết nối nào.</p>}
      {credentials && credentials.length > 0 && <div style={{ display: "grid", gap: 8 }}>
        {credentials.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #dfe3e8", borderRadius: 12, padding: "10px 14px", flexWrap: "wrap", gap: 8 }}>
          <div>
            <b>{PROVIDERS.find((p) => p.value === c.provider)?.label ?? c.provider}</b>{c.label ? ` · ${c.label}` : ""} <small style={{ color: "#9aa4b2" }}>••••{c.apiKeyLast4}</small>
            <div style={{ fontSize: 12, color: STATUS_TONE[c.status] }}>{STATUS_LABEL[c.status]}{c.lastTestError ? ` — ${c.lastTestError}` : ""}{c.lastTestedAt ? ` · ${new Date(c.lastTestedAt).toLocaleString("vi-VN")}` : ""}</div>
            {c.capabilities.length > 0 && <div style={{ fontSize: 11, color: "#718092" }}>{c.capabilities.map((cap) => CAPABILITIES.find((x) => x.key === cap)?.label ?? cap).join(" · ")}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={testingId === c.id} onClick={() => testCredential(c.id)}>{testingId === c.id ? "Đang kiểm tra…" : "Kiểm tra kết nối"}</button>
            <button className="btn" onClick={() => removeCredential(c.id)} aria-label="Xoá kết nối"><Trash2 size={14} /></button>
          </div>
        </div>)}
      </div>}
    </section>

    <div className="enterprise-status">{status}</div>
  </AppShell>;
}
