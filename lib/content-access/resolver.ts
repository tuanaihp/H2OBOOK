import type { AccessGrantFact, ResourceAccessDecision, ResourceAccessFacts, StageAccessFact } from "./domain";

// The single place that decides whether a student may open something. A pure function over facts,
// so it is fully testable without a database and cannot drift per screen — which is the actual
// problem it exists to solve: access was being decided independently in lib/student/stage-access.ts,
// lib/student/outcome-access.ts, lib/business/access.ts and lib/academy/student-course.ts, each
// with its own rules.
//
// Precedence, in order, adapted from the source module:
//   1. not published      -> denied
//   2. an active deny     -> denied, and it beats everything below including a purchase
//   3. purchase           -> granted
//   4. admin/legacy grant -> granted
//   5. membership stage   -> granted
//   6. learning stage     -> granted
//   7. free_preview       -> granted
//   8. a grant that has lapsed -> "expired", which is a different message from "locked"
//   9. otherwise          -> locked, naming the nearest stage that would open it

function isWithinWindow(startsAt: string | null, expiresAt: string | null, nowIso: string): boolean {
  const now = Date.parse(nowIso);
  const starts = startsAt ? Date.parse(startsAt) : Number.NEGATIVE_INFINITY;
  const expires = expiresAt ? Date.parse(expiresAt) : Number.POSITIVE_INFINITY;
  return starts <= now && now < expires;
}

function newestActiveGrant(grants: AccessGrantFact[], predicate: (grant: AccessGrantFact) => boolean, nowIso: string): AccessGrantFact | undefined {
  return grants
    .filter((grant) => predicate(grant) && isWithinWindow(grant.startsAt, grant.expiresAt, nowIso))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0];
}

/** Whether a binding's own unlock rule is satisfied, given its stage is already reachable. */
export function isBindingOpen(stage: StageAccessFact, facts: ResourceAccessFacts): boolean {
  if (!stage.stageUnlocked) return false;
  switch (stage.unlockMode) {
    case "immediate":
      return true;
    case "stage_active":
      return true;
    case "after_resource": {
      if (!stage.prerequisiteBindingId) return false;
      return Boolean(facts.prerequisiteProgress[stage.prerequisiteBindingId]?.completedAt);
    }
    case "progress_gte": {
      if (!stage.prerequisiteBindingId || stage.requiredProgress === null) return false;
      return (facts.prerequisiteProgress[stage.prerequisiteBindingId]?.progressPercent ?? 0) >= stage.requiredProgress;
    }
    case "date":
      return Boolean(stage.unlockAt && Date.parse(facts.now) >= Date.parse(stage.unlockAt));
    case "manual":
      // Deliberately never opens on its own; it waits for an explicit entitlement, which is
      // handled by rules 3 and 4 above and so is already decided before this is reached.
      return false;
    default:
      return false;
  }
}

export function resolveResourceAccess(facts: ResourceAccessFacts): ResourceAccessDecision {
  const base = {
    expiresAt: null as string | null,
    stageSlug: null as string | null,
    stageName: null as string | null,
    progressPercent: facts.progress.progressPercent,
    displayLocations: [] as string[]
  };

  if (facts.resourceStatus !== "published") {
    return {
      ...base,
      access: "denied",
      source: "none",
      reason: facts.resourceStatus === "archived" ? "Tài liệu đã được lưu trữ." : "Tài liệu chưa được xuất bản."
    };
  }

  const deny = newestActiveGrant(facts.grants, (grant) => grant.effect === "deny", facts.now);
  if (deny) {
    return { ...base, access: "denied", source: "none", reason: deny.reason || "Quyền truy cập đã bị thu hồi.", expiresAt: deny.expiresAt };
  }

  const purchase = newestActiveGrant(facts.grants, (grant) => grant.effect === "grant" && grant.grantKind === "purchase", facts.now);
  if (purchase) {
    return { ...base, access: "granted", source: "purchase", reason: "Bạn đã mua tài liệu này.", expiresAt: purchase.expiresAt, displayLocations: ["library", "journey"] };
  }

  const adminGrant = newestActiveGrant(facts.grants, (grant) => grant.effect === "grant" && (grant.grantKind === "admin" || grant.grantKind === "legacy"), facts.now);
  if (adminGrant) {
    return { ...base, access: "granted", source: "admin_grant", reason: adminGrant.reason || "Được quản trị viên cấp quyền.", expiresAt: adminGrant.expiresAt, displayLocations: ["library", "journey"] };
  }

  const membershipStage = facts.stages.find((stage) => stage.viaMembership && isBindingOpen(stage, facts));
  if (membershipStage) {
    return { ...base, access: "granted", source: "membership_stage", reason: `Được mở theo gói thành viên ở ${membershipStage.stageName}.`, stageSlug: membershipStage.stageSlug, stageName: membershipStage.stageName, displayLocations: membershipStage.displayLocations };
  }

  const learningStage = facts.stages.find((stage) => !stage.viaMembership && isBindingOpen(stage, facts));
  if (learningStage) {
    return { ...base, access: "granted", source: "learning_stage", reason: `Được mở trong ${learningStage.stageName}.`, stageSlug: learningStage.stageSlug, stageName: learningStage.stageName, displayLocations: learningStage.displayLocations };
  }

  if (facts.free) {
    return { ...base, access: "granted", source: "free", reason: "Tài liệu học thử miễn phí.", displayLocations: ["library"] };
  }

  // Distinguishing a lapsed grant from never having had one matters: "your access ran out" and
  // "you have not reached this stage" call for completely different next steps.
  const lapsed = facts.grants
    .filter((grant) => grant.effect === "grant" && grant.expiresAt !== null && Date.parse(grant.expiresAt) <= Date.parse(facts.now))
    .sort((a, b) => Date.parse(b.expiresAt!) - Date.parse(a.expiresAt!))[0];
  if (lapsed) {
    return { ...base, access: "expired", source: lapsed.grantKind === "purchase" ? "purchase" : "admin_grant", reason: "Quyền truy cập đã hết hạn.", expiresAt: lapsed.expiresAt };
  }

  const nearestStage = facts.stages
    .filter((stage) => !isBindingOpen(stage, facts))
    .sort((a, b) => a.stageSequence - b.stageSequence)[0];

  return {
    ...base,
    access: "locked",
    source: "none",
    reason: nearestStage ? `Sẽ mở khi bạn vào ${nearestStage.stageName}.` : "Tài khoản chưa có quyền xem tài liệu này.",
    stageSlug: nearestStage?.stageSlug ?? null,
    stageName: nearestStage?.stageName ?? null,
    displayLocations: nearestStage?.displayLocations ?? []
  };
}
