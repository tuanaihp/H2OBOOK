"use client";
import Link from "next/link";
import { Compass, LockKeyhole, Target } from "lucide-react";
import { studentCareerStages } from "@/lib/student/experience";

// H2OBOOK Compact Navigation Upgrade V2 §"Smart Home": the roadmap no longer gets its own
// sidebar item per stage — instead every stage is shown here, on the Smart Home page, so a
// locked stage is still visible (with why it's locked) without adding sidebar clutter.
//
// unlockedStageIds is real per-student data from /api/student/summary (lib/student/stage-access.ts),
// keyed by real career_stages.slug. `stages` (also from that route) is the real stage list to
// match it against — this used to always render experience.ts's hardcoded 5-stage fallback list
// instead, so every student saw the same fixed stage names/descriptions regardless of what was
// actually configured, and (once unlockedStageIds became real slugs) no stage could ever match
// anyway: the fallback list's ids look nothing like a real slug. Falls back to that hardcoded list
// only while `stages` hasn't loaded yet or in demo mode — an explicit, temporary placeholder, not a
// silent substitute for real data.
export function SmartHomeRoadmapWidget({ mastery, unlockedStageIds, stages }: { mastery: number; unlockedStageIds?: string[]; stages?: { slug: string; title: string; description: string }[] }) {
  const unlocked = new Set(unlockedStageIds ?? [studentCareerStages[0]?.id]);
  const items = stages && stages.length
    ? stages.map((stage) => ({ id: stage.slug, title: stage.title, description: stage.description }))
    : studentCareerStages.map((stage) => ({ id: stage.id, title: stage.title, description: stage.description }));
  return <section className="h2o-student-card h2oc-roadmap-widget">
    <header className="h2o-student-card-head">
      <div><span>CAREER MILESTONE</span><h2>Lộ trình nghề nghiệp của bạn</h2><p>{mastery}% mastery — mỗi mốc mở khi bạn nâng cấp hoặc được cấp quyền.</p></div>
      <Link href="/student/roadmap">Xem chi tiết <Compass size={14} /></Link>
    </header>
    <ol className="h2oc-roadmap-stages">
      {items.map((stage, index) => {
        const isUnlocked = unlocked.has(stage.id);
        return <li key={stage.id} data-status={isUnlocked ? "active" : "locked"}>
          <Link href={isUnlocked ? "/student/roadmap" : "/academy/membership"} className="h2oc-roadmap-stage" aria-disabled={!isUnlocked}>
            <span className="h2oc-roadmap-stage-icon">{isUnlocked ? <Target size={15} /> : <LockKeyhole size={15} />}</span>
            <span className="h2oc-roadmap-stage-body">
              <small>MỐC {index + 1}</small>
              <strong>{stage.title}</strong>
              {isUnlocked ? <em>{stage.description}</em> : <em>Đăng ký nâng cấp để mở mốc này</em>}
            </span>
          </Link>
        </li>;
      })}
    </ol>
  </section>;
}
