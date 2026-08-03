"use client";
import { useEffect, useState } from "react";
import { Plus, UserRoundPlus } from "lucide-react";

type Opportunity = { id: string; customerName: string; serviceName: string; estimatedValue: number; status: string; source: string | null; nextActionAt: string | null; notes: string | null; updatedAt: string };

const STATUS_OPTIONS = ["new", "contacted", "consulting", "proposal", "booked", "won", "lost"] as const;
const STATUS_LABEL: Record<string, string> = { new: "Mới", contacted: "Đã liên hệ", consulting: "Đang tư vấn", proposal: "Đã báo giá", booked: "Đã đặt lịch", won: "Đã chốt", lost: "Đã mất" };
const STATUS_COLOR: Record<string, string> = { new: "#6948b8", contacted: "#0c6e86", consulting: "#a05a13", proposal: "#a05a13", booked: "#177a54", won: "#177a54", lost: "#b22949" };

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export default function BusinessCustomersPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [estimatedValue, setEstimatedValue] = useState(0);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/business/opportunities");
    const json = await res.json();
    if (res.ok) setOpportunities(json.opportunities ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addOpportunity() {
    if (!customerName.trim() || !serviceName.trim()) return;
    setSaving(true);
    await fetch("/api/business/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName, serviceName, estimatedValue, source: source || undefined }) });
    setSaving(false);
    setCustomerName(""); setServiceName(""); setEstimatedValue(0); setSource(""); setShowForm(false);
    await load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/business/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
  }

  return <>
    <section className="h2o-student-page-head">
      <div><span>KHÁCH HÀNG &amp; BÁN HÀNG</span><h1>Pipeline khách hàng của bạn</h1><p>Theo dõi lead, trạng thái tư vấn và hành động tiếp theo — chỉ bạn nhìn thấy danh sách này.</p></div>
      <button className="h2o-student-primary" onClick={() => setShowForm((v) => !v)}><UserRoundPlus size={16} />Thêm khách hàng</button>
    </section>

    {showForm && (
      <section className="h2o-student-card" style={{ marginBottom: 18 }}>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên khách hàng
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Dịch vụ
            <input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Makeup cô dâu…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Giá trị ước tính (VND)
            <input type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(Number(e.target.value))} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={addOpportunity}><Plus size={14} />Lưu</button>
        </div>
      </section>
    )}

    <section className="h2o-student-card">
      <header className="h2o-student-card-head"><div><span>PIPELINE</span><h2>{opportunities.length} khách hàng</h2></div></header>
      <div style={{ padding: 18 }}>
        {loading ? <p>Đang tải…</p> : !opportunities.length ? (
          <p style={{ color: "#8d97a6" }}>Chưa có khách hàng nào — thêm khách đầu tiên để bắt đầu theo dõi.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {opportunities.map((opp) => (
              <div key={opp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, border: "1px solid #edf0f2", fontSize: 12, flexWrap: "wrap", gap: 10 }}>
                <div><strong>{opp.customerName}</strong><div style={{ color: "#8d97a6", marginTop: 2 }}>{opp.serviceName} · {formatVnd(opp.estimatedValue)}</div></div>
                <select value={opp.status} onChange={(e) => updateStatus(opp.id, e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", color: STATUS_COLOR[opp.status], fontWeight: 700 }}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  </>;
}
