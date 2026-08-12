"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import { academyDataLinkFeatures } from "@/lib/academy-data-link/feature-flags";
import styles from "@/components/operations/operations.module.css";

type Stage = { id: string; title: string; indexLabel: string; position: number; resources: { id: string; resourceType: string; resourceId: string; title: string }[] };
type Health = {
  stageTitle: string; stagePosition: number; curriculumNodeCount: number; curriculumResourceCount: number;
  journeyVersionCount: number; publishedJourney: boolean; missionCount: number; missionsWithResources: number;
  missionsMissingSuccessCriteria: number; brokenResourceBindings: number; studentSurfaceErrors: number; score: number; warnings: string[];
};
type SetupStep = { id: number; title: string; description: string; state: "not_started" | "in_progress" | "complete" | "warning"; helper?: string | null; actionLabel: string; actionHref: string };
type CurriculumPlacement = { stageId: string; stageTitle: string; stagePosition: number; nodeId?: string | null; programTitle?: string | null; moduleTitle?: string | null; groupTitle?: string | null };
type MissionUsage = { journeyVersionId: string; missionId: string; missionTitle: string; outcomeTitle?: string | null; milestoneTitle?: string | null; bindingRole: string; published: boolean };
type StudentSurfaceUsage = { surface: string; visible: boolean; accessState: string; reason?: string | null };
type ResourceLink = { resourceType: string; resourceId: string; title: string; curriculumPlacements: CurriculumPlacement[]; missionUsages: MissionUsage[]; studentSurfaces: StudentSurfaceUsage[] };
type StageContextCheck = { studentId: string; studentName: string; assignedStageTitle: string; assignedStagePosition: number; journeyStagePosition: number | null; isConsistent: boolean; issues: string[] };

const STATE_LABEL: Record<SetupStep["state"], string> = { not_started: "Chưa làm", in_progress: "Đang làm", complete: "Hoàn tất", warning: "Cảnh báo" };
const STATE_COLOR: Record<SetupStep["state"], string> = { not_started: "#6b7a89", in_progress: "#b7791f", complete: "#177a54", warning: "#b42318" };
const SURFACE_LABEL: Record<string, string> = { library: "Thư viện", journey: "Hành trình", smart_home: "Smart Home" };

export default function AcademyDataLinkPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [guide, setGuide] = useState<SetupStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourceKey, setResourceKey] = useState("");
  const [resourceLink, setResourceLink] = useState<ResourceLink | null>(null);
  const [contextChecks, setContextChecks] = useState<StageContextCheck[] | null>(null);
  const [contextBusy, setContextBusy] = useState(false);

  useEffect(() => {
    fetch("/api/academy-admin/stages", { cache: "no-store" }).then((r) => r.json()).then((json) => {
      const list = (json?.stages ?? []) as Stage[];
      setStages(list);
      if (list[0]) setStageId(list[0].id);
    }).catch(() => null);
  }, []);

  async function loadOverview(forStageId: string) {
    if (!forStageId) return;
    setLoading(true); setResourceLink(null); setResourceKey(""); setContextChecks(null);
    const json = await fetch(`/api/academy-admin/data-link?stageId=${forStageId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setHealth(json?.health ?? null);
    setGuide(json?.guide ?? []);
    setLoading(false);
  }
  useEffect(() => { if (stageId) loadOverview(stageId); }, [stageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStage = stages.find((s) => s.id === stageId) ?? null;

  async function inspectResource(key: string) {
    setResourceKey(key);
    if (!key) { setResourceLink(null); return; }
    const [resourceType, resourceId] = key.split("::");
    const json = await fetch(`/api/academy-admin/data-link/resource?resourceType=${resourceType}&resourceId=${resourceId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setResourceLink(json?.resource ?? null);
  }

  async function runStageContextCheck(log: boolean) {
    setContextBusy(true);
    const json = await fetch(`/api/academy-admin/data-link/stage-context?stageId=${stageId}`, { method: log ? "POST" : "GET", cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setContextChecks(json?.checks ?? []);
    setContextBusy(false);
  }

  const doneSteps = useMemo(() => guide.filter((s) => s.state === "complete").length, [guide]);

  if (!academyDataLinkFeatures.dataLinkOverview) {
    return <SimpleOperationsShell title="Academy Control Center" subtitle="Liên kết dữ liệu" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
      <p style={{ fontSize: 12, color: "#6b7a89" }}>Tính năng Liên kết dữ liệu đang tắt (NEXT_PUBLIC_ACADEMY_DATA_LINK_V1=false).</p>
    </SimpleOperationsShell>;
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Liên kết dữ liệu" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>ACADEMY DATA LINK</span>
        <h1>Liên kết dữ liệu đào tạo</h1>
        <p>Theo dõi Curriculum → Nhiệm vụ → không gian học viên cho một Giai đoạn — không thay thế Curriculum hay Journey, chỉ soi đường nối giữa chúng.</p>
      </div>
      <label style={{ display: "grid", gap: 4, fontSize: 11 }}>Giai đoạn
        <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, minWidth: 220 }}>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.indexLabel ? `${s.indexLabel} — ` : ""}{s.title}</option>)}
        </select>
      </label>
    </header>

    {loading ? <p style={{ fontSize: 12, color: "#6b7a89" }}>Đang tải…</p> : <>
      {health && <section className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardBody} style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><span className={styles.eyebrow}>DATA LINK HEALTH</span><h2 style={{ margin: "4px 0 0" }}>Giai đoạn {String(health.stagePosition).padStart(2, "0")} · {health.stageTitle}</h2></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 30, fontWeight: 700 }}>{health.score}<span style={{ fontSize: 13, color: "#94a3b8" }}>/100</span></div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 14 }}>
            <Metric label="Program/Module/Group" value={health.curriculumNodeCount} />
            <Metric label="Học liệu Curriculum" value={health.curriculumResourceCount} />
            <Metric label="Journey Version" value={health.journeyVersionCount} />
            <Metric label="Nhiệm vụ" value={health.missionCount} />
            <Metric label="Mission có học liệu" value={health.missionsWithResources} />
            <Metric label="Mission thiếu Tiêu chí đạt" value={health.missionsMissingSuccessCriteria} />
          </div>
          {health.warnings.length > 0 && <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
            {health.warnings.map((w, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 10, background: "#fef3c7", fontSize: 12, color: "#92400e" }}><AlertTriangle size={12} />{w}</div>)}
          </div>}
        </div>
      </section>}

      <section className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardBody} style={{ padding: 18 }}>
          <span className={styles.eyebrow}>DATA FLOW</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 10, alignItems: "center", marginTop: 10 }}>
            <FlowBox title="1. Nội dung đào tạo" text="Stage → Program → Module → Group → Resource" />
            <ArrowRight size={16} color="#94a3b8" />
            <FlowBox title="2. Bản đồ kết quả" text="Kết quả → Chặng → Nhiệm vụ → Học liệu" />
            <ArrowRight size={16} color="#94a3b8" />
            <FlowBox title="3. Học viên" text="Journey · Library · Mission Workspace" />
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        {academyDataLinkFeatures.setupGuide && <section className={styles.card}>
          <div className={styles.cardHead}>
            <div><h2>Hướng dẫn cài đặt Academy</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>10 bước đưa dữ liệu tới học viên — trạng thái tính từ dữ liệu thật, không phải checkbox tay.</p></div>
            <strong>{doneSteps}/10</strong>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 8 }}>
            {guide.map((step) => <div key={step.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "center", border: "1px solid #eef1f4", borderRadius: 12, padding: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0f172a", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{step.id}</div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 13 }}>{step.title}</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", color: STATE_COLOR[step.state] }}>{STATE_LABEL[step.state]}</span>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>{step.description}</p>
                {step.helper && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{step.helper}</p>}
              </div>
              <a href={step.actionHref} className={styles.button} style={{ whiteSpace: "nowrap" }}>{step.actionLabel}</a>
            </div>)}
          </div>
        </section>}

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {academyDataLinkFeatures.resourceUsageInspector && <section className={styles.card}>
            <div className={styles.cardHead}><div><h2>Resource Data Link</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Chọn 1 học liệu thật của giai đoạn — không nhập UUID tay.</p></div></div>
            <div style={{ padding: 16 }}>
              <select value={resourceKey} onChange={(e) => inspectResource(e.target.value)} style={{ padding: 8, borderRadius: 8, border: "1px solid #dfe3e8", fontSize: 12, width: "100%" }}>
                <option value="">— Chọn học liệu —</option>
                {(currentStage?.resources ?? []).map((r) => <option key={r.id} value={`${r.resourceType}::${r.resourceId}`}>{r.title || r.resourceId}</option>)}
              </select>

              {resourceLink && <div style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 13, margin: 0 }}>{resourceLink.title}</h3>

                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a89", margin: "12px 0 4px" }}>NẰM TRONG NỘI DUNG ĐÀO TẠO</p>
                {resourceLink.curriculumPlacements.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa gắn vào Curriculum nào.</p>}
                {resourceLink.curriculumPlacements.map((p, i) => <div key={i} style={{ border: "1px solid #eef1f4", borderRadius: 10, padding: 8, fontSize: 12, marginBottom: 6 }}>
                  Giai đoạn {String(p.stagePosition).padStart(2, "0")} → {[p.programTitle, p.moduleTitle, p.groupTitle].filter(Boolean).join(" → ") || "Chưa xếp vào Program/Module/Group"}
                </div>)}

                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a89", margin: "12px 0 4px" }}>ĐƯỢC NHIỆM VỤ SỬ DỤNG</p>
                {resourceLink.missionUsages.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chưa Mission nào dùng học liệu này.</p>}
                {resourceLink.missionUsages.map((m) => <a key={m.missionId} href={`/academy-admin/journey?missionId=${m.missionId}`} style={{ display: "block", border: "1px solid #eef1f4", borderRadius: 10, padding: 8, fontSize: 12, marginBottom: 6, textDecoration: "none", color: "inherit" }}>
                  {m.missionTitle} <small style={{ color: "#94a3b8" }}>· {m.bindingRole} · {m.published ? "Đang áp dụng" : "Bản nháp"}</small>
                </a>)}

                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7a89", margin: "12px 0 4px" }}>HIỂN THỊ CHO HỌC VIÊN</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {resourceLink.studentSurfaces.map((s) => <div key={s.surface} style={{ border: "1px solid #eef1f4", borderRadius: 10, padding: 8, fontSize: 12 }}>
                    <strong>{SURFACE_LABEL[s.surface] ?? s.surface}</strong>
                    <div style={{ fontSize: 10, color: s.visible ? "#177a54" : "#94a3b8" }}>{s.visible ? s.accessState : "Không hiển thị"}</div>
                  </div>)}
                </div>
              </div>}
            </div>
          </section>}

          {academyDataLinkFeatures.stageContextValidator && <section className={styles.card}>
            <div className={styles.cardHead}>
              <div><h2>Stage Context Validator</h2><p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a89" }}>Badge Stage phải khớp career_stages.position ở mọi màn — không lấy từ membership/version/index mảng.</p></div>
              <button className={styles.button} disabled={contextBusy} onClick={() => runStageContextCheck(false)}><RefreshCw size={13} />Kiểm tra</button>
            </div>
            <div style={{ padding: 16 }}>
              {contextChecks === null && <p style={{ fontSize: 12, color: "#6b7a89" }}>Bấm &ldquo;Kiểm tra&rdquo; để đối chiếu Stage của học viên thật ở giai đoạn này.</p>}
              {contextChecks?.length === 0 && <p style={{ fontSize: 12, color: "#6b7a89" }}>Chưa có học viên thật nào để đối chiếu ở giai đoạn này.</p>}
              {contextChecks && contextChecks.length > 0 && <>
                <div style={{ display: "grid", gap: 6 }}>
                  {contextChecks.map((c) => <div key={c.studentId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eef1f4", borderRadius: 10, padding: 8, fontSize: 12 }}>
                    <span>{c.isConsistent ? <CheckCircle2 size={13} color="#177a54" style={{ verticalAlign: "-2px" }} /> : <AlertTriangle size={13} color="#b42318" style={{ verticalAlign: "-2px" }} />} {c.studentName}</span>
                    <span style={{ color: "#6b7a89" }}>{c.isConsistent ? `Giai đoạn ${String(c.assignedStagePosition).padStart(2, "0")}` : c.issues[0]}</span>
                  </div>)}
                </div>
                {contextChecks.some((c) => !c.isConsistent) && <button className={styles.button} style={{ marginTop: 10 }} disabled={contextBusy} onClick={() => runStageContextCheck(true)}><AlertTriangle size={13} />Ghi nhận cảnh báo P1 (domain event)</button>}
              </>}
            </div>
          </section>}
        </div>
      </div>
    </>}
  </SimpleOperationsShell>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12 }}>
    <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 10, color: "#6b7a89" }}>{label}</div>
  </div>;
}

function FlowBox({ title, text }: { title: string; text: string }) {
  return <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12 }}>
    <strong style={{ fontSize: 12 }}>{title}</strong>
    <div style={{ fontSize: 11, color: "#6b7a89", marginTop: 2 }}>{text}</div>
  </div>;
}
