"use client";
import { useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, Compass, Sparkles } from "lucide-react";
import type { JourneyGoal, JourneyRecommendation, JourneyStage } from "@/lib/public-home-v3/types";
import { TrackedLink } from "./tracked-link";
import styles from "./public-home-v3.module.css";

const stages: Array<{ value: JourneyStage; label: string }> = [
  { value: "new", label: "Người mới bắt đầu" },
  { value: "first-clients", label: "Đang tìm khách đầu tiên" },
  { value: "professional", label: "Đã làm nghề" },
  { value: "team", label: "Đang xây đội nhóm" },
  { value: "academy", label: "Studio / học viện" },
];

const goals: Array<{ value: JourneyGoal; label: string }> = [
  { value: "technique", label: "Nâng kỹ thuật" },
  { value: "clients", label: "Có khách" },
  { value: "brand", label: "Xây thương hiệu" },
  { value: "business", label: "Vận hành kinh doanh" },
  { value: "automation", label: "AI & tự động hóa" },
];

export function JourneyPlanner({ recommendations }: { recommendations: JourneyRecommendation[] }) {
  const [stage, setStage] = useState<JourneyStage>("new");
  const [goal, setGoal] = useState<JourneyGoal>("technique");
  const recommendation = useMemo(
    () => recommendations.find((item) => item.stage === stage && item.goal === goal)
      ?? recommendations.find((item) => item.stage === stage)
      ?? recommendations[0],
    [goal, recommendations, stage],
  );

  return (
    <section className={styles.journeySection} data-public-home-section="journey-planner">
      <div className={styles.journeyCopy}>
        <span className={styles.eyebrow}><BrainCircuit /> H2O PATH INTELLIGENCE</span>
        <h2>Không bắt đầu bằng việc mua khóa học. Bắt đầu bằng việc xác định đúng giai đoạn.</h2>
        <p>Chọn vị trí hiện tại và mục tiêu ưu tiên. Hệ thống sẽ đề xuất một điểm bắt đầu rõ ràng bằng sách, khóa học và chiến lược liên quan.</p>
        <ul>
          <li><CheckCircle2 /> Không gợi ý lan man</li>
          <li><CheckCircle2 /> Có đầu ra nghề nghiệp cụ thể</li>
          <li><CheckCircle2 /> AI chỉ hỗ trợ, quy tắc lõi vẫn chạy độc lập</li>
        </ul>
      </div>
      <div className={styles.journeyPanel}>
        <div className={styles.selectorGroup}>
          <label htmlFor="h2o-stage">Bạn đang ở giai đoạn nào?</label>
          <select id="h2o-stage" value={stage} onChange={(event) => setStage(event.target.value as JourneyStage)}>
            {stages.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className={styles.selectorGroup}>
          <label htmlFor="h2o-goal">Mục tiêu ưu tiên?</label>
          <select id="h2o-goal" value={goal} onChange={(event) => setGoal(event.target.value as JourneyGoal)}>
            {goals.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
        </div>
        {recommendation && <article className={styles.recommendationCard}>
          <span><Sparkles /> ĐỀ XUẤT PHÙ HỢP</span>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.summary}</p>
          <div className={styles.recommendationMetrics}>
            <small><Compass /> {recommendation.relatedBookSlugs.length} sách</small>
            <small>{recommendation.relatedCourseSlugs.length} khóa học</small>
            <small>{recommendation.relatedStrategySlugs.length} chiến lược</small>
          </div>
          <TrackedLink
            href={recommendation.href}
            section="journey-planner"
            action="open-recommendation"
            resourceId={`${stage}:${goal}`}
            className={styles.primaryAction}
          >
            Mở lộ trình đề xuất <ArrowRight />
          </TrackedLink>
        </article>}
      </div>
    </section>
  );
}
