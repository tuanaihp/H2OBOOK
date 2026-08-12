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
  useEffect(() => {
    if (!live) return;
    fetch("/api/student/passport", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { passport?: PassportData } | null) => setPassport(payload?.passport ?? null))
      .catch(() => setPassport(null));
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
  </>;
}
