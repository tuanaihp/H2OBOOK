// Pure metrics/task logic — ported as-is from
// v5/13-h2obook-business-growth-commerce-engine-v1/src/core/command-center.ts.
import { getAllowedBusinessFeatures } from "./access";
import type { BusinessAccessSnapshot, BusinessCommandView, BusinessGoal, BusinessMetrics, BusinessOpportunity, BusinessTask } from "./types";

export function calculateBusinessMetrics(opportunities: BusinessOpportunity[]): BusinessMetrics {
  return opportunities.reduce<BusinessMetrics>((metrics, opportunity) => {
    metrics.leads += 1;
    if (!["new", "lost"].includes(opportunity.status)) metrics.qualifiedLeads += 1;
    if (["booked", "won"].includes(opportunity.status)) metrics.bookings += 1;
    if (opportunity.status === "won") metrics.revenue += opportunity.estimatedValue;
    return metrics;
  }, { leads: 0, qualifiedLeads: 0, bookings: 0, revenue: 0, repeatCustomers: 0, publishedContent: 0 });
}

export function calculateGoalProgress(goal: BusinessGoal): number {
  if (goal.targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((goal.currentValue / goal.targetValue) * 100)));
}

export function buildBusinessTasks(metrics: BusinessMetrics): BusinessTask[] {
  const tasks: BusinessTask[] = [];
  if (metrics.leads < 5) {
    tasks.push({ id: "task-first-leads", title: "Tạo danh sách 5 khách hàng tiềm năng đầu tiên", description: "Đưa khách thật vào Lead Tracker và đặt hành động tiếp theo.", priority: "high", feature: "lead_tracker", completed: false });
  }
  if (metrics.publishedContent < 3) {
    tasks.push({ id: "task-content-proof", title: "Đăng 3 nội dung chứng minh tay nghề", description: "Dùng Portfolio và Casebook từ Create để tạo nội dung có bằng chứng.", priority: "normal", feature: "content_90_days", completed: false });
  }
  if (metrics.bookings === 0) {
    tasks.push({ id: "task-offer", title: "Hoàn thiện gói dịch vụ đầu tiên", description: "Chốt phạm vi, giá, lợi ích và CTA để sẵn sàng tư vấn khách.", priority: "urgent", feature: "pricing_builder", completed: false });
  }
  return tasks;
}

export function buildBusinessCommandView(snapshot: BusinessAccessSnapshot, opportunities: BusinessOpportunity[], goals: BusinessGoal[], publishedContent: number): BusinessCommandView {
  const metrics = { ...calculateBusinessMetrics(opportunities), publishedContent };
  const primaryGoal = goals[0];
  const progress = primaryGoal ? calculateGoalProgress(primaryGoal) : 0;
  const highestStage = Math.max(1, ...snapshot.unlockedStages);

  return {
    headline: metrics.bookings > 0 ? "Biến kỹ năng thành doanh thu ổn định." : "Tạo bằng chứng, tiếp cận khách và có booking đầu tiên.",
    stageLabel: `Giai đoạn nghề nghiệp ${highestStage}`,
    progress,
    metrics,
    tasks: buildBusinessTasks(metrics),
    unlockedFeatures: getAllowedBusinessFeatures(snapshot).filter((decision) => decision.allowed),
    nextMilestone: metrics.bookings === 0 ? "Booking đầu tiên" : metrics.revenue < 10_000_000 ? "10 triệu doanh thu đầu tiên" : "Hệ thống khách hàng quay lại"
  };
}
