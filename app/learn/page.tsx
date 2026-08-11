"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ArrowRight, BookOpenCheck, Brain, Compass, FileQuestion, GraduationCap, LibraryBig, School, UsersRound, Workflow } from "lucide-react";

type Summary = {
  stages: { total: number; published: number };
  documents: number; missions: number; activeStudents: number; studentsWithProgress: number;
  flashcards: number; knowledgeSpaces: number; classes: number; assignments: number; quizzes: number;
};

/**
 * Learning Control Center (v5/32-H2OBOOK_LEARN_OUTCOME_OS_V4 §9).
 *
 * This page used to render the workspace Owner as if they were a learner — a Zustand demo store's
 * fake "55% Mastery", fake study minutes, fake personal goals and fake due-flashcard counts. §9 is
 * explicit that Admin must NOT mirror Student LEARN. It now answers the admin question ("how is
 * training going across this organization") from real counts, and routes each of the 7 modules to
 * wherever it genuinely lives — including the two that do not exist yet, marked as such rather than
 * pointed at something unrelated.
 */
export default function LearningControlCenterPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/learning-control/summary");
      if (res.status === 403) { setDenied(true); setLoading(false); return; }
      const json = await res.json().catch(() => null);
      setData(json?.summary ?? null);
      setLoading(false);
    })();
  }, []);

  const value = (n: number | undefined) => (loading ? "…" : String(n ?? 0));

  const modules: { icon: typeof Compass; title: string; purpose: string; href: string | null; stat: string }[] = [
    { icon: Compass, title: "Giai đoạn & Nội dung đào tạo", purpose: "Cấu hình Stage, Program, Module và tài liệu học viên thấy.", href: "/academy-admin/stages", stat: loading ? "…" : `${data?.stages.published ?? 0}/${data?.stages.total ?? 0} giai đoạn đang publish` },
    { icon: Workflow, title: "Journey & Outcomes", purpose: "Outcome, Mission, unlock, Evidence và Result.", href: "/academy-admin/journey", stat: loading ? "…" : `${data?.missions ?? 0} Mission` },
    { icon: LibraryBig, title: "Knowledge & Library", purpose: "Kho tài liệu canonical và gắn tài liệu vào lộ trình.", href: "/academy-admin/content", stat: loading ? "…" : `${data?.documents ?? 0} tài liệu` },
    { icon: Brain, title: "Smart Review", purpose: "Flashcard, spaced repetition và review rules.", href: null, stat: loading ? "…" : `${data?.flashcards ?? 0} flashcard` },
    { icon: School, title: "Classes & Cohorts", purpose: "Lớp học, cohort, lịch học và giảng viên.", href: "/instructor/classes", stat: loading ? "…" : `${data?.classes ?? 0} lớp trong bảng classes` },
    { icon: BookOpenCheck, title: "Assignment & Review", purpose: "Bài tập, submission, teacher review và rubric.", href: "/instructor/assessments", stat: "Hàng đợi chấm bài thật" },
    { icon: FileQuestion, title: "Quiz & Assessment", purpose: "Question bank, quiz, test và assessment.", href: null, stat: loading ? "…" : `${data?.quizzes ?? 0} quiz` }
  ];

  return <AppShell>
    <section className="quantum-hero learning-hero">
      <div>
        <span className="eyebrow">LEARNING CONTROL CENTER</span>
        <h1>Quản trị trải nghiệm học tập của tổ chức.</h1>
        <p>Cùng domain với LEARN của học viên nhưng khác vai trò: cấu hình, vận hành, review, phân tích và publish — không phải màn hình học cá nhân.</p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/academy-admin"><GraduationCap size={17}/>Academy Control Center</Link>
          <Link className="btn btn-secondary" href="/academy-admin/journey"><Workflow size={17}/>Bản đồ kết quả học viên</Link>
        </div>
      </div>
    </section>

    {denied
      ? <section className="section-card"><div className="section-body" style={{ padding: 18 }}><p style={{ margin: 0, fontSize: 13 }}>Khu vực này dành cho Owner/Admin/Giảng viên của tổ chức.</p></div></section>
      : <>
          <section className="smart-metric-grid">
            <article><span><Compass/></span><div><strong>{loading ? "…" : `${data?.stages.published ?? 0}/${data?.stages.total ?? 0}`}</strong><small>Giai đoạn đang publish</small></div></article>
            <article><span><LibraryBig/></span><div><strong>{value(data?.documents)}</strong><small>Tài liệu trong kho</small></div></article>
            <article><span><Workflow/></span><div><strong>{value(data?.missions)}</strong><small>Mission đã cấu hình</small></div></article>
            <article><span><UsersRound/></span><div><strong>{loading ? "…" : `${data?.studentsWithProgress ?? 0}/${data?.activeStudents ?? 0}`}</strong><small>Học viên đã có tiến độ</small></div></article>
          </section>

          <section className="section-card">
            <div className="section-head"><div><h2>7 module đào tạo</h2><p>Mỗi module trỏ tới nơi nó thực sự được quản trị. Số liệu là đếm thật từ cơ sở dữ liệu.</p></div></div>
            <div className="section-body" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", padding: 18 }}>
              {modules.map((module) => {
                const Icon = module.icon;
                const inner = <>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 11, background: "#eefaff", color: "#19869e", display: "grid", placeItems: "center", flex: "none" }}><Icon size={17}/></span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13, display: "block" }}>{module.title}</strong>
                      <small style={{ display: "block", marginTop: 3, color: "#83858e", lineHeight: 1.5 }}>{module.purpose}</small>
                      <small style={{ display: "block", marginTop: 6, fontWeight: 700, color: module.href ? "#19869e" : "#b7791f" }}>{module.stat}</small>
                    </div>
                    {module.href && <ArrowRight size={15} style={{ marginLeft: "auto", flex: "none", color: "#9aa3ad" }}/>}
                  </div>
                  {!module.href && <small style={{ display: "block", marginTop: 8, color: "#b7791f" }}>Chưa có trang quản trị — cần quyết định phạm vi riêng</small>}
                </>;
                return <div key={module.title} style={{ border: "1px solid #e4e8ec", borderRadius: 14, padding: 14, background: module.href ? "#fff" : "#fcfaf6", opacity: module.href ? 1 : 0.85 }}>
                  {module.href ? <Link href={module.href} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link> : inner}
                </div>;
              })}
            </div>
          </section>

          <section className="learning-path-strip">
            <div><GraduationCap/><span><strong>Học viên học ở đâu?</strong><small>Trải nghiệm học thật của học viên nằm ở khu /student — khu này chỉ để quản trị.</small></span></div>
            <Link href="/academy-admin">Mở Academy Control Center <ArrowRight size={14}/></Link>
          </section>
        </>}
  </AppShell>;
}
