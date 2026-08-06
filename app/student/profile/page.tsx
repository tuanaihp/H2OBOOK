"use client";
import { Award, BookOpen, Camera, Clock3, GraduationCap, Star } from "lucide-react";
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

export default function StudentProfilePage() {
  const studentName = useStudentName("Học viên H2O");
  const { identity, summary, loaded, live } = useStudentData();
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
          ? <EmptyNote>Chưa có chứng nhận nào. Chứng nhận được cấp kèm mã xác minh sau khi bạn hoàn thành khóa học và đạt bài đánh giá cuối.</EmptyNote>
          : <div className="h2o-certificate-card"><Award /><span><small>SKILL CERTIFICATE</small><strong>Chứng nhận mẫu</strong><p>Đây là dữ liệu minh họa của chế độ demo.</p></span></div>}
      </section>
    </div>

    <section className="h2o-student-card h2o-portfolio-section">
      <header className="h2o-student-card-head">
        <div>
          <span>MY PORTFOLIO</span>
          <h2>Bằng chứng năng lực</h2>
          <p>Các bài thực hành đã được giảng viên duyệt sẽ xuất hiện ở đây.</p>
        </div>
      </header>
      {live
        ? <EmptyNote>Portfolio của bạn còn trống. Mỗi bài thực hành được duyệt sẽ tự động trở thành một mục ở đây — bạn không cần tự thêm.</EmptyNote>
        : <div className="h2o-portfolio-grid">{["Nền cô dâu trong trẻo", "Makeup tiệc ứng dụng", "Sóng lơi cô dâu"].map((title, index) => <article key={title}>
            <div><span>0{index + 1}</span><Camera /></div>
            <strong>{title}</strong>
            <small>Dữ liệu minh họa</small>
          </article>)}</div>}
    </section>
  </>;
}
