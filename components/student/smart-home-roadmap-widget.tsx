"use client";
import Link from "next/link";
import { Compass, LockKeyhole, Target } from "lucide-react";
import { studentCareerStages } from "@/lib/student/experience";

// H2OBOOK Compact Navigation Upgrade V2 §"Smart Home": the roadmap no longer gets its own
// sidebar item per stage — instead every stage is shown here, on the Smart Home page, so a
// locked stage is still visible (with why it's locked) without adding sidebar clutter.
//
// unlockedStageIds is real per-student data from /api/student/summary (lib/student/stage-access.ts)
// — every stage used to render as the same hardcoded status for every user. When it isn't
// available yet (still loading, or demo mode), only the first (free) stage is shown unlocked
// instead of falling back to a fabricated "most stages done" state.
export function SmartHomeRoadmapWidget({ mastery, unlockedStageIds }: { mastery: number; unlockedStageIds?: string[] }) {
  const unlocked = new Set(unlockedStageIds ?? [studentCareerStages[0]?.id]);
  return <section className="h2o-student-card h2oc-roadmap-widget">
    <header className="h2o-student-card-head">
      <div><span>CAREER MILESTONE</span><h2>Lộ trình nghề nghiệp của bạn</h2><p>{mastery}% mastery — mỗi mốc mở khi bạn nâng cấp hoặc được cấp quyền.</p></div>
      <Link href="/student/roadmap">Xem chi tiết <Compass size={14} /></Link>
    </header>
    <ol className="h2oc-roadmap-stages">
      {studentCareerStages.map((stage, index) => {
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
