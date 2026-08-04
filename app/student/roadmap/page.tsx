import Link from "next/link";
import { ArrowRight, Compass, LockKeyhole, Sparkles, Target } from "lucide-react";
import { studentCareerStages, studentSkills } from "@/lib/student/experience";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getAcademySkillProgress } from "@/lib/academy/student-course";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getUnlockedStageIds } from "@/lib/student/stage-access";

export default async function StudentRoadmapPage() {
  const user = await requireCurrentUser();
  const organizationId = user.demo ? undefined : await configuredAcademyOrganizationId();
  const [live, unlockedStageIds] = await Promise.all([
    getAcademySkillProgress(user),
    organizationId ? getUnlockedStageIds(user.id, organizationId) : Promise.resolve(new Set([studentCareerStages[0]?.id]))
  ]);
  const skills = studentSkills.map((skill) => {
    const value = live?.get(skill.id);
    if (!live) return skill;
    const progress = value?.progress ?? 0;
    return { ...skill, progress, status: progress >= 100 ? "completed" as const : progress > 0 ? "active" as const : "locked" as const, evidence: value ? `${value.evidenceCount} bài học đã hoàn thành` : "Chưa có bằng chứng bài học" };
  });
  const mastery = Math.round(skills.reduce((sum, skill) => sum + skill.progress, 0) / Math.max(1, skills.length));
  // Real per-student unlock (lib/student/stage-access.ts) replaces the previous hardcoded status
  // that was identical for every user regardless of their actual membership/grants.
  const stages = studentCareerStages.map((stage) => ({ ...stage, status: unlockedStageIds.has(stage.id) ? "active" as const : "locked" as const }));
  const currentStage = stages.find((stage) => stage.status === "active") ?? stages[0];

  return <>
    <section className="h2o-student-page-head"><div><span>CAREER NAVIGATION</span><h1>Lộ trình nghề nghiệp của tôi</h1><p>Biết vị trí hiện tại, kỹ năng còn thiếu và điều kiện để mở mốc tiếp theo.</p></div><Link className="h2o-student-secondary" href="/student/mentor"><Sparkles />Hỏi Mentor về lộ trình</Link></section>
    <section className="h2o-roadmap-summary"><Compass /><div><span>GIAI ĐOẠN HIỆN TẠI</span><h2>{currentStage?.title ?? "Học viên nền tảng"}</h2><p>{currentStage?.description ?? "Bắt đầu với kiến thức miễn phí, nâng cấp khi bạn sẵn sàng."}</p></div><aside><strong>{mastery}%</strong><span><i style={{ width: `${mastery}%` }} /></span><small>Skill Map cập nhật khi bạn hoàn thành bài học</small></aside></section>
    <div className="h2o-career-stage-list">{stages.map((stage, index) => <article key={stage.id} className={stage.status}>
      <div className="h2o-stage-marker">{stage.status === "active" ? <Target /> : <LockKeyhole />}<i /></div>
      <div><small>MỐC {index + 1}</small><h2>{stage.title}</h2><p>{stage.description}</p><div>{stage.requirements.map((item) => <span key={item}><i />{item}</span>)}</div></div>
      {stage.status === "active" ? <Link href="/student/assignments">Hoàn thiện điều kiện <ArrowRight /></Link> : <Link href="/academy/membership">Đăng ký nâng cấp <ArrowRight /></Link>}
    </article>)}</div>
    <section className="h2o-student-section"><header><div><span>DETAILED SKILL MAP</span><h2>Năng lực theo bốn trụ cột</h2></div></header><div className="h2o-skill-detail-grid">{["Makeup", "Hair", "Career", "Business"].map((group) => <article key={group}><header><span>{group}</span><strong>{Math.round(skills.filter((s) => s.group === group).reduce((sum, s) => sum + s.progress, 0) / Math.max(1, skills.filter((s) => s.group === group).length))}%</strong></header>{skills.filter((skill) => skill.group === group).map((skill) => <div key={skill.id}><span><strong>{skill.title}</strong><small>{skill.evidence}</small></span><em><i style={{ width: `${skill.progress}%` }} /></em><b>{skill.progress}%</b></div>)}</article>)}</div></section>
  </>;
}
