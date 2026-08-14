import Link from "next/link";
import { ArrowRight, Compass, LockKeyhole, Sparkles, Target } from "lucide-react";
import { studentSkills } from "@/lib/student/experience";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getAcademySkillProgress } from "@/lib/academy/student-course";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { getUnlockedStageIds, resolveCurrentStageId } from "@/lib/student/stage-access";
import { loadCareerStages } from "@/lib/career-stages/service";

export default async function StudentRoadmapPage() {
  const user = await requireCurrentUser();
  const organizationId = user.demo ? undefined : await configuredAcademyOrganizationId();
  const [live, unlockedStageIds, careerStages] = await Promise.all([
    getAcademySkillProgress(user),
    organizationId ? getUnlockedStageIds(user.id, organizationId) : Promise.resolve(new Set<string>()),
    // The 6 real stages configured in the admin panel — this used to be a hardcoded 5-stage English-id
    // array (foundation/practice/first-client/professional/leader) that never matched whatever an
    // admin actually configured. Only `status` (locked/active) was ever real; title/description/
    // requirements were fabricated and drifted from the real curriculum the moment an admin edited it.
    organizationId ? loadCareerStages(organizationId) : Promise.resolve([])
  ]);
  const skills = studentSkills.map((skill) => {
    const value = live?.get(skill.id);
    if (!live) return skill;
    const progress = value?.progress ?? 0;
    return { ...skill, progress, status: progress >= 100 ? "completed" as const : progress > 0 ? "active" as const : "locked" as const, evidence: value ? `${value.evidenceCount} bài học đã hoàn thành` : "Chưa có bằng chứng bài học" };
  });
  const mastery = Math.round(skills.reduce((sum, skill) => sum + skill.progress, 0) / Math.max(1, skills.length));
  const orderedCareerStages = [...careerStages].sort((a, b) => a.position - b.position);
  const stages = orderedCareerStages
    .map((stage) => ({
      id: stage.id, title: stage.title, description: stage.description || stage.subtitle,
      requirements: stage.skills,
      // Unlock set is keyed by slug (lib/student/stage-access.ts), matching every other consumer
      // of getUnlockedStageIds (lib/content-access/facts.ts, /api/student/library) — not id.
      status: unlockedStageIds.has(stage.slug) ? "active" as const : "locked" as const
    }));
  // "Current" prefers the highest-position unlocked stage that actually has a published journey —
  // plain highest-unlocked would show a stage granted ahead of schedule with nothing built yet
  // (see resolveCurrentStageId's comment for the real bug this fixed on 2026-08-14).
  const currentStageId = organizationId ? await resolveCurrentStageId(organizationId, orderedCareerStages, unlockedStageIds) : null;
  const currentStage = stages.find((stage) => stage.id === currentStageId) ?? stages[0];

  return <>
    <section className="h2o-student-page-head"><div><span>CAREER NAVIGATION</span><h1>Lộ trình nghề nghiệp của tôi</h1><p>Biết vị trí hiện tại, kỹ năng còn thiếu và điều kiện để mở mốc tiếp theo.</p></div><Link className="h2o-student-secondary" href="/student/mentor"><Sparkles />Hỏi Mentor về lộ trình</Link></section>
    {stages.length === 0
      ? <section className="h2o-student-card empty-state"><p>{organizationId ? "Học viện chưa cấu hình giai đoạn nào." : "Bạn đang ở chế độ xem thử — chưa có tổ chức thật để hiển thị lộ trình."}</p></section>
      : <>
        <section className="h2o-roadmap-summary"><Compass /><div><span>GIAI ĐOẠN HIỆN TẠI</span><h2>{currentStage?.title ?? "Chưa mở giai đoạn nào"}</h2><p>{currentStage?.description ?? "Hoàn thành điều kiện để mở giai đoạn đầu tiên."}</p></div><aside><strong>{mastery}%</strong><span><i style={{ width: `${mastery}%` }} /></span><small>Skill Map cập nhật theo bài học đã hoàn thành</small></aside></section>
        <div className="h2o-career-stage-list">{stages.map((stage, index) => <article key={stage.id} className={stage.status}>
          <div className="h2o-stage-marker">{stage.status === "active" ? <Target /> : <LockKeyhole />}<i /></div>
          <div><small>MỐC {index + 1}</small><h2>{stage.title}</h2><p>{stage.description}</p><div>{stage.requirements.map((item) => <span key={item}><i />{item}</span>)}</div></div>
          {stage.status === "active" ? <Link href="/student/assignments">Hoàn thiện điều kiện <ArrowRight /></Link> : <Link href="/academy/membership">Đăng ký nâng cấp <ArrowRight /></Link>}
        </article>)}</div>
      </>}
    <section className="h2o-student-section"><header><div><span>DETAILED SKILL MAP</span><h2>Năng lực theo bốn trụ cột</h2></div></header><div className="h2o-skill-detail-grid">{["Makeup", "Hair", "Career", "Business"].map((group) => <article key={group}><header><span>{group}</span><strong>{Math.round(skills.filter((s) => s.group === group).reduce((sum, s) => sum + s.progress, 0) / Math.max(1, skills.filter((s) => s.group === group).length))}%</strong></header>{skills.filter((skill) => skill.group === group).map((skill) => <div key={skill.id}><span><strong>{skill.title}</strong><small>{skill.evidence}</small></span><em><i style={{ width: `${skill.progress}%` }} /></em><b>{skill.progress}%</b></div>)}</article>)}</div></section>
  </>;
}
