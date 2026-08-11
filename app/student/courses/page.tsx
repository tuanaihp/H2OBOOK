import { requireCurrentUser } from "@/lib/auth/current-user";
import { getStudentCourseSummaries } from "@/lib/academy/student-course";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getUnlockedStageIds } from "@/lib/student/stage-access";
import { loadCareerStages } from "@/lib/career-stages/service";
import { getSmartJourneyReadModel } from "@/lib/smart-journey/student";
import { emitDomainEvent } from "@/lib/domain/events";
import { SmartJourneyShell } from "@/components/student/smart-journey/smart-journey-shell";
import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// "Hành trình của tôi" (LEARN tab 1) — the Smart Journey Shell (docs/smart-journey-v3): one read
// model, one shell, Map/Roadmap/Danh sách/Today as views inside it rather than three separate
// pages. Route kept as /student/courses so the sidebar link and every existing deep link keep
// working. The old course catalog is not deleted: it renders underneath as "Khóa học bổ trợ".
export default async function StudentCoursesPage() {
  const user = await requireCurrentUser();
  const courses = await getStudentCourseSummaries(user);

  if (user.demo) return <JourneyUnavailable message="Chế độ demo chưa có dữ liệu hành trình thật." courses={courses} />;
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId) return <JourneyUnavailable message="Tổ chức chưa được cấu hình." courses={courses} />;

  const [stages, unlockedStageIds] = await Promise.all([loadCareerStages(organizationId), getUnlockedStageIds(user.id, organizationId)]);
  const orderedStages = [...stages].sort((a, b) => a.position - b.position);
  const currentStage = [...orderedStages].reverse().find((s) => unlockedStageIds.has(s.slug)) ?? orderedStages[0] ?? null;
  if (!currentStage) return <JourneyUnavailable message="Chưa có giai đoạn nào được mở." courses={courses} />;

  const model = await getSmartJourneyReadModel(user.id, organizationId, currentStage.id);
  if (!model) return <JourneyUnavailable message="Giai đoạn này đang được xây dựng hành trình." courses={courses} />;

  void emitDomainEvent({ organizationId, actorId: user.id, resourceType: "learning_journey_versions", resourceId: model.journeyVersionId, eventName: "journey.viewed", payload: { stageId: currentStage.id } }).catch(() => {});

  return <>
    <SmartJourneyShell model={model} />
    {courses.length > 0 && <section className="h2o-student-section" style={{ marginTop: 24 }}>
      <header><div><span>KHÓA HỌC BỔ TRỢ</span><h2>Khóa học video liên quan</h2></div></header>
      <div className="h2o-student-course-grid">{courses.slice(0, 3).map((course) => <article key={course.slug}><div style={{ background: course.accent }}><span>{course.category}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><Link href={course.access ? `/student/courses/${course.slug}` : `/academy/courses/${course.slug}`}>Xem <ArrowRight size={13} /></Link></article>)}</div>
    </section>}
  </>;
}

function JourneyUnavailable({ message, courses }: { message: string; courses: Awaited<ReturnType<typeof getStudentCourseSummaries>> }) {
  return <>
    <section className="h2o-student-page-head"><div><span>H2O NEURAL JOURNEY</span><h1>Hành trình của tôi</h1></div></section>
    <section className="h2o-sr-panel" style={{ padding: 28, textAlign: "center", marginBottom: 24 }}>
      <Compass size={22} style={{ opacity: 0.5 }} />
      <p style={{ marginTop: 8, fontSize: 13 }}>{message}</p>
    </section>
    {courses.length > 0 && <section className="h2o-student-section">
      <header><div><span>KHÓA HỌC BỔ TRỢ</span><h2>Khóa học video liên quan</h2></div></header>
      <div className="h2o-student-course-grid">{courses.slice(0, 3).map((course) => <article key={course.slug}><div style={{ background: course.accent }}><span>{course.category}</span></div><h3>{course.title}</h3><p>{course.subtitle}</p><Link href={course.access ? `/student/courses/${course.slug}` : `/academy/courses/${course.slug}`}>Xem <ArrowRight size={13} /></Link></article>)}</div>
    </section>}
  </>;
}
