import { describe, expect, it } from "vitest";
import type { ResourceAccessFacts, StageAccessFact } from "@/lib/content-access/domain";
import { isBindingOpen, resolveResourceAccess } from "@/lib/content-access/resolver";

// Ported and extended from v5/18-h2obook-content-access-engine-v1/tests. The resolver is a pure
// function precisely so the precedence order can be pinned here without a database.

const NOW = "2026-08-05T12:00:00.000Z";
const EARLIER = "2026-08-01T00:00:00.000Z";
const LATER = "2026-09-01T00:00:00.000Z";
const PAST = "2026-07-01T00:00:00.000Z";

function facts(overrides: Partial<ResourceAccessFacts> = {}): ResourceAccessFacts {
  return {
    resourceStatus: "published",
    free: false,
    grants: [],
    stages: [],
    prerequisiteProgress: {},
    progress: { progressPercent: 0, completedAt: null },
    now: NOW,
    ...overrides
  };
}

function stage(overrides: Partial<StageAccessFact> = {}): StageAccessFact {
  return {
    stageSlug: "starter",
    stageName: "Người mới bắt đầu",
    stageSequence: 0,
    stageUnlocked: true,
    unlockMode: "immediate",
    prerequisiteBindingId: null,
    requiredProgress: null,
    unlockAt: null,
    displayLocations: ["library"],
    viaMembership: false,
    ...overrides
  };
}

describe("precedence", () => {
  it("denies anything not published, before any grant is considered", () => {
    const withPurchase = { grants: [{ effect: "grant" as const, grantKind: "purchase" as const, reason: "Đã mua", startsAt: EARLIER, expiresAt: null }] };
    expect(resolveResourceAccess(facts({ resourceStatus: "draft", ...withPurchase })).access).toBe("denied");
    expect(resolveResourceAccess(facts({ resourceStatus: "archived", ...withPurchase })).access).toBe("denied");
  });

  it("lets a deny beat a purchase — a revocation must not be undone by having paid", () => {
    const decision = resolveResourceAccess(facts({
      grants: [
        { effect: "grant", grantKind: "purchase", reason: "Đã mua", startsAt: EARLIER, expiresAt: null },
        { effect: "deny", grantKind: "revoke", reason: "Khóa vì chia sẻ tài khoản", startsAt: EARLIER, expiresAt: null }
      ]
    }));
    expect(decision.access).toBe("denied");
    expect(decision.reason).toBe("Khóa vì chia sẻ tài khoản");
  });

  it("lets a deny beat an unlocked stage and a membership", () => {
    const decision = resolveResourceAccess(facts({
      grants: [{ effect: "deny", grantKind: "revoke", reason: "Thu hồi", startsAt: EARLIER, expiresAt: null }],
      stages: [stage({ viaMembership: true })]
    }));
    expect(decision.access).toBe("denied");
  });

  it("prefers a purchase over an admin grant as the reported source", () => {
    const decision = resolveResourceAccess(facts({
      grants: [
        { effect: "grant", grantKind: "admin", reason: "Tặng", startsAt: EARLIER, expiresAt: null },
        { effect: "grant", grantKind: "purchase", reason: "Đã mua", startsAt: EARLIER, expiresAt: null }
      ]
    }));
    expect(decision.access).toBe("granted");
    expect(decision.source).toBe("purchase");
  });

  it("reports membership before a plain learning stage", () => {
    const decision = resolveResourceAccess(facts({ stages: [stage(), stage({ stageSlug: "leader", viaMembership: true })] }));
    expect(decision.source).toBe("membership_stage");
  });

  it("falls back to free only after every grant and stage rule has failed", () => {
    const decision = resolveResourceAccess(facts({ free: true, stages: [stage({ stageUnlocked: false })] }));
    expect(decision.access).toBe("granted");
    expect(decision.source).toBe("free");
  });
});

describe("expired is not the same as locked", () => {
  it("reports expired when a grant existed and has lapsed", () => {
    const decision = resolveResourceAccess(facts({
      grants: [{ effect: "grant", grantKind: "purchase", reason: "Đã mua", startsAt: PAST, expiresAt: EARLIER }]
    }));
    expect(decision.access).toBe("expired");
    expect(decision.source).toBe("purchase");
    expect(decision.expiresAt).toBe(EARLIER);
  });

  it("reports locked, naming the nearest stage, when there never was a grant", () => {
    const decision = resolveResourceAccess(facts({
      stages: [stage({ stageSlug: "leader", stageName: "Xây đội nhóm", stageSequence: 3, stageUnlocked: false }), stage({ stageSlug: "first-client", stageName: "Có khách đầu tiên", stageSequence: 1, stageUnlocked: false })]
    }));
    expect(decision.access).toBe("locked");
    expect(decision.stageName).toBe("Có khách đầu tiên");
    expect(decision.reason).toContain("Có khách đầu tiên");
  });

  it("treats a not-yet-started grant as absent rather than active", () => {
    const decision = resolveResourceAccess(facts({
      grants: [{ effect: "grant", grantKind: "admin", reason: "Mở sau", startsAt: LATER, expiresAt: null }]
    }));
    expect(decision.access).toBe("locked");
  });
});

describe("unlock modes", () => {
  it("keeps a locked stage shut whatever the mode says", () => {
    for (const unlockMode of ["immediate", "stage_active", "date"] as const) {
      expect(isBindingOpen(stage({ stageUnlocked: false, unlockMode, unlockAt: PAST }), facts())).toBe(false);
    }
  });

  it("opens on immediate and stage_active once the stage is reachable", () => {
    expect(isBindingOpen(stage({ unlockMode: "immediate" }), facts())).toBe(true);
    expect(isBindingOpen(stage({ unlockMode: "stage_active" }), facts())).toBe(true);
  });

  it("never opens on manual — it waits for an explicit grant", () => {
    expect(isBindingOpen(stage({ unlockMode: "manual" }), facts())).toBe(false);
  });

  it("opens on date only once the moment has passed", () => {
    expect(isBindingOpen(stage({ unlockMode: "date", unlockAt: PAST }), facts())).toBe(true);
    expect(isBindingOpen(stage({ unlockMode: "date", unlockAt: LATER }), facts())).toBe(false);
    expect(isBindingOpen(stage({ unlockMode: "date", unlockAt: null }), facts())).toBe(false);
  });

  it("opens on after_resource only when the prerequisite is actually completed", () => {
    const binding = stage({ unlockMode: "after_resource", prerequisiteBindingId: "binding-1" });
    expect(isBindingOpen(binding, facts())).toBe(false);
    expect(isBindingOpen(binding, facts({ prerequisiteProgress: { "binding-1": { progressPercent: 100, completedAt: null } } }))).toBe(false);
    expect(isBindingOpen(binding, facts({ prerequisiteProgress: { "binding-1": { progressPercent: 100, completedAt: NOW } } }))).toBe(true);
  });

  it("opens on progress_gte at the threshold, not merely near it", () => {
    const binding = stage({ unlockMode: "progress_gte", prerequisiteBindingId: "binding-1", requiredProgress: 80 });
    expect(isBindingOpen(binding, facts({ prerequisiteProgress: { "binding-1": { progressPercent: 79.9, completedAt: null } } }))).toBe(false);
    expect(isBindingOpen(binding, facts({ prerequisiteProgress: { "binding-1": { progressPercent: 80, completedAt: null } } }))).toBe(true);
  });

  it("does not open progress_gte when the rule is incompletely configured", () => {
    expect(isBindingOpen(stage({ unlockMode: "progress_gte", prerequisiteBindingId: null, requiredProgress: 50 }), facts())).toBe(false);
    expect(isBindingOpen(stage({ unlockMode: "progress_gte", prerequisiteBindingId: "b", requiredProgress: null }), facts())).toBe(false);
  });
});
