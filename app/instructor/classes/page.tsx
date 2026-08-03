"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, School } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type TeachingClassSummary = { id: string; name: string; code: string; status: string; studentCount: number; avgProgressPercent: number; atRiskCount: number };

export default function InstructorClassesPage() {
  const [classes, setClasses] = useState<TeachingClassSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/teaching/classes");
      const json = await res.json();
      if (res.ok) setClasses(json.classes ?? []);
      setLoading(false);
    })();
  }, []);

  return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Class Command Center" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>CLASS COMMAND CENTER</span><h1>Lớp của tôi</h1><p>Tiến độ trung bình được tính từ Knowledge Space Progress thực tế của từng học viên trong lớp.</p></div>
    </header>

    <div className={styles.card}>
      <div className={styles.cardHead}><div><h2>Danh sách lớp</h2><p>{classes.length} lớp</p></div></div>
      <div className={styles.cardBody}>
        {loading ? <p>Đang tải…</p> : !classes.length ? (
          <div className={styles.empty}><School /><strong>Chưa có lớp nào</strong><p>Bạn chưa được gán làm giáo viên của lớp nào trong hệ thống.</p></div>
        ) : (
          <div className={styles.list}>
            {classes.map((klass) => (
              <div key={klass.id} className={styles.listItem}>
                <span className={styles.listItemIcon}><School size={16} /></span>
                <div>
                  <strong>{klass.name}</strong>
                  <small>{klass.code} · {klass.studentCount} học viên</small>
                  <div className={styles.progress} style={{ marginTop: 6, width: 220 }}><i style={{ width: `${klass.avgProgressPercent}%` }} /></div>
                </div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={klass.status === "active" ? "success" : undefined}>{klass.status}</span>
                  {klass.atRiskCount > 0 && <em style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginTop: 4 }}><AlertTriangle size={11} />{klass.atRiskCount} cần hỗ trợ</em>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </SimpleOperationsShell>;
}
