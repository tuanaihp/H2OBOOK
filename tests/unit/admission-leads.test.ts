import { describe, expect, it } from "vitest";
import {
  appendLeadNote,
  canInviteLead,
  indexApplicationsByEmail,
  isLeadStage,
  mapAdmissionLeadRow,
  sanitizeLeadNote,
  type AdmissionLeadRow
} from "@/lib/operations/admission-leads";

const row: AdmissionLeadRow = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  name: "Lan Anh",
  phone: "0901234567",
  email: " LanAnh@Example.com ",
  source: "academy_public",
  interest: "Makeup Pro",
  stage: "qualified",
  next_action_at: null,
  expected_value: "12500000",
  notes: null,
  tags: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z"
};

describe("admission leads", () => {
  it("maps a database row into the CRM shape", () => {
    const lead = mapAdmissionLeadRow(row);
    expect(lead).toMatchObject({ email: "lananh@example.com", stage: "qualified", expectedValue: 12_500_000, notes: "", tags: [], canInvite: true });
    expect(mapAdmissionLeadRow({ ...row, stage: "bogus" }).stage).toBe("new");
  });

  it("only allows inviting open leads with an email and no provisioned application", () => {
    expect(canInviteLead({ email: "a@b.vn", stage: "new" })).toBe(true);
    expect(canInviteLead({ email: "", stage: "new" })).toBe(false);
    expect(canInviteLead({ email: "a@b.vn", stage: "enrolled" })).toBe(false);
    expect(canInviteLead({ email: "a@b.vn", stage: "lost" })).toBe(false);
    expect(canInviteLead({ email: "a@b.vn", stage: "paid" }, { id: "x", status: "new" })).toBe(true);
    expect(canInviteLead({ email: "a@b.vn", stage: "paid" }, { id: "x", status: "rejected" })).toBe(true);
    expect(canInviteLead({ email: "a@b.vn", stage: "paid" }, { id: "x", status: "invited" })).toBe(false);
    expect(canInviteLead({ email: "a@b.vn", stage: "paid" }, { id: "x", status: "converted" })).toBe(false);
  });

  it("keeps the newest application per normalized email", () => {
    const index = indexApplicationsByEmail([
      { id: "newest", email: "A@b.vn", status: "new" },
      { id: "older", email: "a@b.vn", status: "rejected" }
    ]);
    expect(index.get("a@b.vn")).toEqual({ id: "newest", status: "new" });
  });

  it("validates stages and notes", () => {
    expect(isLeadStage("deposit")).toBe(true);
    expect(isLeadStage("archived")).toBe(false);
    expect(sanitizeLeadNote(undefined)).toBe("");
    expect(sanitizeLeadNote("  gọi lại  ")).toBe("gọi lại");
    expect(sanitizeLeadNote(42)).toBeNull();
    expect(sanitizeLeadNote("x".repeat(2001))).toBeNull();
    expect(appendLeadNote("cũ", "mới")).toBe("cũ\nmới");
    expect(appendLeadNote(null, "mới")).toBe("mới");
  });
});
