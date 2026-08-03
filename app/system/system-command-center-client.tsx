"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudCog, HelpCircle, XCircle } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { OperationsMetric } from "@/components/operations/metric-card";
import { systemRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type ServiceCheck = {
  key: string; label: string; description: string; required: boolean;
  configuration: "configured" | "missing" | "not_required";
  connection: "connected" | "failed" | "not_tested";
  operational: "healthy" | "degraded" | "down" | "unknown";
  latencyMs?: number; checkedAt: string; evidenceSource: string; message?: string;
};
type Alert = { id: string; title: string; severity: "critical" | "high" | "medium" | "low" | "info" };
type HealthResponse = { score: number; state: "healthy" | "degraded" | "down"; requiredTotal: number; requiredHealthy: number; alerts: Alert[]; checks: ServiceCheck[]; environment: string };

const STATE_TONE: Record<string, "success" | "warning" | "danger"> = { healthy: "success", degraded: "warning", down: "danger", connected: "success", failed: "danger", not_tested: "warning", configured: "success", missing: "danger", not_required: "warning", unknown: "warning" };
const STATE_ICON: Record<string, typeof CheckCircle2> = { healthy: CheckCircle2, connected: CheckCircle2, configured: CheckCircle2, degraded: AlertTriangle, down: XCircle, failed: XCircle, missing: XCircle, not_tested: HelpCircle, unknown: HelpCircle, not_required: HelpCircle };

export function SystemCommandCenterClient() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/system/health");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Không tải được dữ liệu."); setLoading(false); return; }
      setData(json);
      setLoading(false);
    })();
  }, []);

  const requiredChecks = data?.checks.filter((c) => c.required) ?? [];
  const optionalChecks = data?.checks.filter((c) => !c.required) ?? [];

  return <SimpleOperationsShell title="H2OBOOK System" subtitle="Control Plane" homeHref="/system" routes={systemRoutes} accentLabel="System Command Center">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>SYSTEM COMMAND CENTER</span><h1>{loading ? "Đang kiểm tra hệ thống…" : `Health Score: ${data?.score ?? 0}/100`}</h1><p>Trạng thái thật của các dịch vụ — không phải số liệu demo. Môi trường: {data?.environment ?? "…"}.</p></div>
    </header>

    {error && <p style={{ color: "#b22949", fontSize: 12 }}>{error}</p>}

    <section className={styles.metrics}>
      <OperationsMetric icon={CloudCog} value={data ? `${data.score}/100` : "…"} label="Health Score" />
      <OperationsMetric icon={CheckCircle2} value={data ? `${data.requiredHealthy}/${data.requiredTotal}` : "…"} label="Dịch vụ bắt buộc khỏe mạnh" />
      <OperationsMetric icon={AlertTriangle} value={data?.alerts.length ?? 0} label="Cảnh báo đang mở" />
      <OperationsMetric icon={CheckCircle2} value={data?.state === "healthy" ? "Ổn định" : data?.state === "degraded" ? "Suy giảm" : data?.state === "down" ? "Gián đoạn" : "…"} label="Trạng thái tổng thể" />
    </section>

    {!!data?.alerts.length && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div className={styles.cardHead}><div><h2>Cảnh báo</h2><p>Cần xử lý</p></div></div>
        <div className={styles.cardBody}>
          <div className={styles.list}>{data.alerts.map((alert) => <div key={alert.id} className={styles.listItem}><span className={styles.listItemIcon}><AlertTriangle size={16} /></span><strong>{alert.title}</strong><div className={styles.listItemMeta}><span className={styles.badge} data-tone={alert.severity === "critical" ? "danger" : "warning"}>{alert.severity}</span></div></div>)}</div>
        </div>
      </section>
    )}

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><div><h2>Dịch vụ bắt buộc</h2><p>Bắt buộc phải hoạt động để hệ thống chạy đúng</p></div></div>
      <div className={styles.cardBody}>
        {loading ? <p>Đang tải…</p> : (
          <div className={styles.list}>
            {requiredChecks.map((check) => {
              const Icon = STATE_ICON[check.operational];
              return <div key={check.key} className={styles.listItem}>
                <span className={styles.listItemIcon}><Icon size={16} /></span>
                <div><strong>{check.label}</strong><small>{check.description}{check.message ? ` — ${check.message}` : ""}</small></div>
                <div className={styles.listItemMeta} style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className={styles.badge} data-tone={STATE_TONE[check.configuration]}>{check.configuration}</span>
                  <span className={styles.badge} data-tone={STATE_TONE[check.connection]}>{check.connection}</span>
                  <span className={styles.badge} data-tone={STATE_TONE[check.operational]}>{check.operational}</span>
                </div>
              </div>;
            })}
          </div>
        )}
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.cardHead}><div><h2>Dịch vụ tùy chọn / có điều kiện</h2><p>Không tính vào Health Score khi chưa bật tính năng liên quan</p></div></div>
      <div className={styles.cardBody}>
        <div className={styles.list}>
          {optionalChecks.map((check) => {
            const Icon = STATE_ICON[check.configuration];
            return <div key={check.key} className={styles.listItem}>
              <span className={styles.listItemIcon}><Icon size={16} /></span>
              <div><strong>{check.label}</strong><small>{check.description}</small></div>
              <div className={styles.listItemMeta}><span className={styles.badge} data-tone={STATE_TONE[check.configuration]}>{check.configuration}</span></div>
            </div>;
          })}
        </div>
      </div>
    </section>
  </SimpleOperationsShell>;
}
