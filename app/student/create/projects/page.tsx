"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

type ProjectRow = { id: string; title: string; outcome_type: string; status: string; progress_percent: number; readiness_score: number; updated_at: string };

export default function MyOutcomeProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/create/projects").then((res) => res.json()).then((json) => setProjects(json.projects ?? [])).finally(() => setLoading(false)); }, []);

  return <section className="h2o-student-card">
    <header className="h2o-student-card-head"><div><span>THÀNH QUẢ CỦA TÔI</span><h2>Dự án của tôi</h2></div><Link href="/student/create" className="btn btn-primary btn-sm"><Plus size={14} />Tạo mới</Link></header>
    <div style={{ padding: 16 }}>
      {loading ? <p>Đang tải…</p> : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#8d97a6" }}><FolderKanban style={{ margin: "0 auto 10px" }} /><p>Chưa có dự án nào. <Link href="/student/create">Bắt đầu tạo thành quả đầu tiên</Link>.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {projects.map((project) => (
            <Link key={project.id} href={`/student/create/projects/${project.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 14, border: "1px solid #edf0f2", textDecoration: "none", color: "inherit" }}>
              <div><strong>{project.title}</strong><br /><small style={{ color: "#8d97a6" }}>{project.outcome_type} · {project.status}</small></div>
              <div style={{ textAlign: "right" }}><strong>{project.readiness_score}%</strong><br /><small style={{ color: "#8d97a6" }}>hoàn thiện</small></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  </section>;
}
