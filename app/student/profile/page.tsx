"use client";
import { useEffect, useState } from "react";
import { Award, BookOpen, Camera, CheckCircle2, Clock3, GraduationCap, Star } from "lucide-react";
import { useStudentData, useStudentName } from "@/components/student/student-data";
import { studentAchievements } from "@/lib/student/experience";

// Rewritten for the data-truth pass. Every figure here used to be a constant: 68% progress, 42
// hours of practice, 7 books read, an average score of 82, a class of "K26", a city, "18 days
// since joining", a granted certificate, and six portfolio pieces with names. A student opening
// their own profile on day one read all of it as theirs.
//
// Now: a real session shows real numbers, or an empty state saying the section has nothing yet.
// The sample data stays for the signed-out demo tour, which is what it was made for.

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, padding: "14px 0", color: "#718092", fontSize: 13, lineHeight: 1.6 }}>{children}</p>;
}

interface PortfolioItem { id: string; title: string; score: number | null; approvedAt: string | null; summary: string }
interface PassportData {
  career: { direction: string | null; careerMapSummary: string | null; ninetyDayGoal: string | null };
  credential: { status: "locked" | "eligible" | "issued"; certificateNo: string | null; issuedAt: string | null };
}
interface CompetencyClass {
  class: { id: string; name: string; code: string; status: string };
  completedSessions: number; totalSessions: number; avgScore: number; evaluationCount: number;
  graduation: { graduationStatus: "graduated" | "not_ready"; passingEvaluationRatio: number; missingRequirements: string[] } | null;
  competency: { key: string; label: string; latestScore: number | null; trend30: number | null; trend60: number | null; trend90: number | null }[] | null;
}

export default function StudentProfilePage() {
  const studentName = useStudentName("Học viên H2O");
  const { identity, summary, loaded, live } = useStudentData();

  // Portfolio entries are derived from graded submissions an instructor marked portfolio_ready.
  // Nothing here can be added by hand — that is what separates evidence from a claim.
  const [portfolio, setPortfolio] = useState<PortfolioItem[] | null>(null);
  useEffect(() => {
    if (!live) return;
    fetch("/api/student/portfolio", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: PortfolioItem[] } | null) => setPortfolio(payload?.items ?? []))
      .catch(() => setPortfolio([]));
  }, [live]);

  // Student Journey Passport (docs/stage1-learning-os-v1) — Career direction/Career Map/90-day goal
  // and real Credential status, aggregated from Stage 1's actual Mission graph. null while loading
  // or if Stage 1 isn't configured yet — never a placeholder that reads as a real value.
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [competencyClasses, setCompetencyClasses] = useState<CompetencyClass[] | null>(null);
  useEffect(() => {
    if (!live) return;
    fetch("/api/student/passport", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { passport?: PassportData } | null) => setPassport(payload?.passport ?? null))
      .catch(() => setPassport(null));
  }, [live]);
  useEffect(() => {
    if (!live) return;
    fetch("/api/student/competency", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((payload: { classes?: CompetencyClass[] } | null) => setCompetencyClasses(payload?.classes ?? [])).catch(() => setCompetencyClasses([]));
  }, [live]);
  const production = summary?.mode === "production" ? summary : null;

  // Only four figures have a real source today. Practice hours, books read and average score do
  // not — rather than keep showing invented ones, the tiles report what is actually known.
  const metrics = [
    { icon: <GraduationCap />, value: production ? `${production.mastery}%` : loaded ? "—" : "…", label: "Tiến độ tổng thể" },
    { icon: <BookOpen />, value: production ? `${production.completedLessons}/${production.totalLessons}` : loaded ? "—" : "…", label: "Bài đã hoàn thành" },
    { icon: <Star />, value: production ? String(production.activeCourses) : loaded ? "—" : "…", label: "Khóa đang học" },
    { icon: <Clock3 />, value: production ? String(production.skillMastery.filter((skill) => skill.masteryPercent > 0).length) : loaded ? "—" : "…", label: "Kỹ năng đã mở" }
  ];

  return <>
    <section className="h2o-student-profile-hero">
      <div className="h2o-profile-avatar">{studentName.split(" ").slice(-1)[0]?.slice(0, 1) ?? "H"}<i /></div>
      <div>
        <span>ACADEMY STUDENT</span>
        <h1>{studentName}</h1>
        <p>{identity?.email || "Hành trình Makeup Artist chuyên nghiệp"}</p>
      </div>
    </section>

    <section className="h2o-student-metrics profile">
      {metrics.map((metric) => <article key={metric.label}>
        <span>{metric.icon}</span>
        <div><strong>{metric.value}</strong><small>{metric.label}</small></div>
      </article>)}
    </section>

    <div className="h2o-student-dashboard-grid profile">
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>ACHIEVEMENTS</span><h2>Thành tựu &amp; huy hiệu</h2></div></header>
        {live
          ? <EmptyNote>Bạn chưa có thành tựu nào. Thành tựu được trao khi bạn hoàn thành bài học và bài thực hành được giảng viên duyệt.</EmptyNote>
          : <div className="h2o-profile-achievements">{studentAchievements.map((item) => <article key={item.title}>
              <span>{item.icon}</span>
              <div><strong>{item.title}</strong><small>{item.description}</small></div>
            </article>)}</div>}
      </section>

      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>CERTIFICATES</span><h2>Chứng nhận</h2></div></header>
        {live
          ? (passport?.credential.status === "issued"
              ? <div className="h2o-certificate-card"><Award /><span><small>CHỨNG NHẬN STAGE 1</small><strong>{passport.credential.certificateNo}</strong><p>Cấp ngày {passport.credential.issuedAt ? new Date(passport.credential.issuedAt).toLocaleDateString("vi-VN") : "—"} · Xác minh tại /verify/{passport.credential.certificateNo}</p></span></div>
              : passport?.credential.status === "eligible"
                ? <EmptyNote>Bạn đã đủ điều kiện nhận chứng nhận Stage 1 — liên hệ giảng viên để được cấp.</EmptyNote>
                : <EmptyNote>Chưa có chứng nhận nào. Chứng nhận Stage 1 được cấp kèm mã xác minh sau khi bạn hoàn thành toàn bộ Nhiệm vụ.</EmptyNote>)
          : <div className="h2o-certificate-card"><Award /><span><small>SKILL CERTIFICATE</small><strong>Chứng nhận mẫu</strong><p>Đây là dữ liệu minh họa của chế độ demo.</p></span></div>}
      </section>
    </div>

    {live && passport && (passport.career.direction || passport.career.careerMapSummary || passport.career.ninetyDayGoal) && (
      <section className="h2o-student-card">
        <header className="h2o-student-card-head"><div><span>CAREER PASSPORT</span><h2>Định hướng nghề</h2><p>Tổng hợp thật từ các Nhiệm vụ Stage 1 bạn đã hoàn thành.</p></div></header>
        <div className="h2o-profile-achievements">
          {passport.career.direction && <article><span>🎯</span><div><strong>Hướng nghề</strong><small>{passport.career.direction}</small></div></article>}
          {passport.career.careerMapSummary && <article><span>🗺️</span><div><strong>Career Map</strong><small>{passport.career.careerMapSummary}</small></div></article>}
          {passport.career.ninetyDayGoal && <article><span>📅</span><div><strong>Mục tiêu 90 ngày</strong><small>{passport.career.ninetyDayGoal}</small></div></article>}
        </div>
      </section>
    )}

    <section className="h2o-student-card h2o-portfolio-section">
      <header className="h2o-student-card-head">
        <div>
          <span>MY PORTFOLIO</span>
          <h2>Bằng chứng năng lực</h2>
          <p>Các bài thực hành đã được giảng viên duyệt sẽ xuất hiện ở đây.</p>
        </div>
      </header>
      {live
        ? (portfolio === null
            ? <EmptyNote>Đang tải portfolio…</EmptyNote>
            : portfolio.length === 0
              ? <EmptyNote>Portfolio của bạn còn trống. Mỗi bài thực hành được giảng viên duyệt sẽ tự động trở thành một mục ở đây — bạn không cần tự thêm.</EmptyNote>
              : <div className="h2o-portfolio-grid">{portfolio.map((item, index) => <article key={item.id}>
                  <div><span>{String(index + 1).padStart(2, "0")}</span><CheckCircle2 /></div>
                  <strong>{item.title}</strong>
                  <small>{item.approvedAt ? `Được duyệt ${new Date(item.approvedAt).toLocaleDateString("vi-VN")}` : "Đã được duyệt"}{item.score !== null ? ` · ${item.score} điểm` : ""}</small>
                </article>)}</div>)
        : <div className="h2o-portfolio-grid">{["Nền cô dâu trong trẻo", "Makeup tiệc ứng dụng", "Sóng lơi cô dâu"].map((title, index) => <article key={title}>
            <div><span>0{index + 1}</span><Camera /></div>
            <strong>{title}</strong>
            <small>Dữ liệu minh họa</small>
          </article>)}</div>}
    </section>

    {live && <section className="h2o-student-card" style={{ marginTop: 18 }}><header className="h2o-student-card-head"><div><span>STUDENT MANAGEMENT &amp; COMPETENCY</span><h2>Hồ sơ năng lực tại lớp</h2><p>Điểm và nhận xét do giảng viên lưu; học viên chỉ có quyền xem.</p></div></header>
      {competencyClasses === null ? <EmptyNote>Đang tải hồ sơ năng lực…</EmptyNote> : competencyClasses.length === 0 ? <EmptyNote>Bạn chưa được ghi danh vào lớp đào tạo trực tiếp nào.</EmptyNote> : competencyClasses.map((item) => { const strengths = (item.competency ?? []).filter((skill) => (skill.latestScore ?? 0) >= 85).slice(0, 3); const weaknesses = (item.competency ?? []).filter((skill) => skill.latestScore != null && skill.latestScore < 60).slice(0, 3); return <article key={item.class.id} style={{ borderTop: "1px solid #e8edf2", padding: "16px 0" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.class.name}</strong><p style={{ margin: "4px 0", fontSize: 12, color: "#718092" }}>{item.class.code} · {item.completedSessions}/{item.totalSessions || 60} buổi · {item.evaluationCount} lần đánh giá</p></div><span style={{ fontWeight: 700 }}>{item.avgScore}/100 · {item.graduation?.graduationStatus === "graduated" ? "Đủ điều kiện tốt nghiệp" : "Đang hoàn thiện"}</span></div><p style={{ fontSize: 12 }}><b>Điểm mạnh:</b> {strengths.length ? strengths.map((skill) => skill.label).join(", ") : "Chưa đủ dữ liệu"} · <b>Cần cải thiện:</b> {weaknesses.length ? weaknesses.map((skill) => skill.label).join(", ") : "Chưa phát hiện"}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>{(item.competency ?? []).filter((skill) => skill.latestScore != null).map((skill) => <div key={skill.key} style={{ border: "1px solid #e8edf2", borderRadius: 10, padding: 10 }}><small>{skill.label}</small><strong style={{ display: "block", fontSize: 20 }}>{skill.latestScore}</strong><small>30/60/90: {skill.trend30 ?? "—"}/{skill.trend60 ?? "—"}/{skill.trend90 ?? "—"}</small></div>)}</div></article>; })}
    </section>}
  </>;
}
