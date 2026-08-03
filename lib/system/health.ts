// Pure health scoring — adapted from
// v5/14-h2obook-system-control-plane-operations-intelligence-v2/src/core/health.ts. The source
// module scores a separate ServiceCheck[] against a SERVICE_REGISTRY; this repo already has a
// real, live config-state source (lib/runtime-config.ts's getRuntimeCapabilities()), so this
// scores that directly instead of introducing a second, parallel service registry with its own
// (inevitably drifting) set of service ids. See lib/system/live-health.ts for how real
// ServiceHealthCheck[] rows are built before being passed in here.
import type { HealthScoreResult, HealthState, ServiceHealthCheck, SystemAlert } from "./types";

function operationalPenalty(state: HealthState): number {
  switch (state) {
    case "healthy": return 0;
    case "degraded": return 12;
    case "down": return 35;
    case "unknown": return 18;
  }
}

export function calculateHealthScore(checks: ServiceHealthCheck[]): HealthScoreResult {
  const required = checks.filter((check) => check.required);
  let score = 100;
  let requiredHealthy = 0;
  const alerts: SystemAlert[] = [];

  for (const check of required) {
    const configBad = check.configuration === "missing";
    const connectionBad = check.connection === "failed";
    const penalty = operationalPenalty(check.operational);

    if (!configBad && !connectionBad && check.operational === "healthy") requiredHealthy += 1;

    if (configBad) {
      score -= 20;
      alerts.push({ id: `config:${check.key}`, title: `${check.label} chưa được cấu hình`, severity: "critical", serviceKey: check.key, createdAt: check.checkedAt, status: "open" });
    }
    if (connectionBad) {
      score -= 15;
      alerts.push({ id: `connection:${check.key}`, title: `${check.label} kết nối thất bại`, severity: "high", serviceKey: check.key, createdAt: check.checkedAt, status: "open" });
    }
    if (penalty > 0 && !configBad) {
      score -= penalty;
      if (check.operational === "down") alerts.push({ id: `down:${check.key}`, title: `${check.label} đang gián đoạn`, severity: "critical", serviceKey: check.key, createdAt: check.checkedAt, status: "open" });
    }
  }

  score = Math.max(0, Math.min(100, score));
  const state: HealthState = score < 50 ? "down" : score < 85 ? "degraded" : "healthy";

  return { score, state, requiredTotal: required.length, requiredHealthy, alerts, checks };
}
