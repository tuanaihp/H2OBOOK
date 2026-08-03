"use client";
import Link from "next/link";
import { CheckCircle2, Compass, LockKeyhole, Target } from "lucide-react";
import { studentCareerStages } from "@/lib/student/experience";

// H2OBOOK Compact Navigation Upgrade V2 §"Smart Home": the roadmap no longer gets its own
// sidebar item per stage — instead every stage is shown here, on the Smart Home page, so a
// locked stage is still visible (with why it's locked) without adding sidebar clutter.
export function SmartHomeRoadmapWidget({ mastery }: { mastery: number }) {
  return <section className="h2o-student-card h2oc-roadmap-widget">
    <header className="h2o-student-card-head">
      <div><span>CAREER MILESTONE</span><h2>Lộ trình nghề nghiệp của bạn</h2><p>{mastery}% mastery — mỗi mốc mở khi hoàn thành các điều kiện bên dưới.</p></div>
      <Link href="/student/roadmap">Xem chi tiết <Compass size={14} /></Link>
    </header>
    <ol className="h2oc-roadmap-stages">
      {studentCareerStages.map((stage, index) => (
        <li key={stage.id} data-status={stage.status}>
          <Link href="/student/roadmap" className="h2oc-roadmap-stage" aria-disabled={stage.status === "locked"}>
            <span className="h2oc-roadmap-stage-icon">{stage.status === "completed" ? <CheckCircle2 size={15} /> : stage.status === "active" ? <Target size={15} /> : <LockKeyhole size={15} />}</span>
            <span className="h2oc-roadmap-stage-body">
              <small>MỐC {index + 1}</small>
              <strong>{stage.title}</strong>
              {stage.status === "locked" ? <em>Mở sau khi hoàn thành mốc trước — {stage.requirements[0]}</em> : <em>{stage.description}</em>}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  </section>;
}
