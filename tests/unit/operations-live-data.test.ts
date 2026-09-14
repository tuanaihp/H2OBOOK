import { describe, expect, it } from "vitest";
import {
  isApprovalDecision,
  isTicketStatus,
  mapApprovalRequestRow,
  mapSupportTicketRow
} from "@/lib/operations/live-data";

describe("operations live data", () => {
  it("maps a support ticket row into the CRM shape", () => {
    const names = new Map([["user_1", "An Nguyễn"]]);
    const ticket = mapSupportTicketRow({
      id: "t1", code: "SUP-0001", requester_name: "Minh", requester_type: "student",
      category: "account", subject: "Không đăng nhập được", description: "…",
      priority: "high", status: "open", assignee_id: "user_1",
      created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z"
    }, names);
    expect(ticket).toMatchObject({
      id: "t1", code: "SUP-0001", requesterName: "Minh", requesterType: "student",
      category: "account", priority: "high", status: "open", assigneeName: "An Nguyễn"
    });
  });

  it("maps an approval request row with requester and reviewer names", () => {
    const names = new Map([["u_req", "GV Mai"], ["u_rev", "Admin Tuấn"]]);
    const approval = mapApprovalRequestRow({
      id: "a1", request_type: "course", title: "Khóa makeup cơ bản",
      requester_id: "u_req", reviewer_id: "u_rev", status: "approved",
      risk_level: "medium", decision_note: "ok", due_at: null,
      created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z"
    }, names);
    expect(approval).toMatchObject({
      id: "a1", type: "course", title: "Khóa makeup cơ bản",
      requesterName: "GV Mai", reviewerName: "Admin Tuấn", status: "approved", riskLevel: "medium"
    });
  });

  it("falls back to safe defaults for missing fields", () => {
    const ticket = mapSupportTicketRow({ id: "t2" }, new Map());
    expect(ticket.status).toBe("open");
    expect(ticket.priority).toBe("normal");
    const approval = mapApprovalRequestRow({ id: "a2" }, new Map());
    expect(approval.status).toBe("pending");
    expect(approval.requesterName).toBe("—");
  });

  it("validates ticket statuses and approval decisions strictly", () => {
    expect(isTicketStatus("in_progress")).toBe(true);
    expect(isTicketStatus("done")).toBe(false);
    expect(isTicketStatus(3)).toBe(false);
    expect(isApprovalDecision("changes_requested")).toBe(true);
    expect(isApprovalDecision("pending")).toBe(false);
  });
});
