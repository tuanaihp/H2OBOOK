import Link from "next/link";
import { LockKeyhole, ShieldAlert, Clock3 } from "lucide-react";

// H2OBOOK Production Gap Audit §4.7: a dedicated page for access-denial reasons instead of a
// silent redirect. Currently reached from middleware.ts's admin-only route gate (reason=
// "unauthorized"); "entitlement_required"/"membership_expired" are built and ready for future
// content-gating call sites (docs/H2OBOOK_PRODUCTION_GAP_AUDIT.md §4.7 acceptance criteria) but
// nothing routes to them yet — no code path currently needs them, so none was invented.
const REASONS = {
  unauthorized: { icon: ShieldAlert, title: "Bạn không có quyền truy cập trang này", description: "Tài khoản hiện tại không đủ quyền để mở khu vực này. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên workspace.", cta: { href: "/dashboard", label: "Về trang chính" } },
  entitlement_required: { icon: LockKeyhole, title: "Nội dung này cần được cấp quyền", description: "Bạn cần mua khóa học, đăng ký membership hoặc được cấp quyền thủ công để mở nội dung này.", cta: { href: "/academy/courses", label: "Xem Knowledge Store" } },
  membership_expired: { icon: Clock3, title: "Membership của bạn đã hết hạn", description: "Gia hạn membership để tiếp tục sử dụng các quyền lợi đi kèm.", cta: { href: "/academy/membership", label: "Xem gói Membership" } }
} as const;

type ReasonKey = keyof typeof REASONS;

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<{ reason?: string; from?: string }> }) {
  const params = await searchParams;
  const reasonKey: ReasonKey = params.reason && params.reason in REASONS ? (params.reason as ReasonKey) : "unauthorized";
  const reason = REASONS[reasonKey];
  const Icon = reason.icon;

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f3f7", padding: 24 }}>
    <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 24, padding: "3rem 2.5rem", boxShadow: "0 30px 90px rgba(40,18,38,.14)", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 1.5rem", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#b30d59,#8146dc)", color: "#fff" }}>
        <Icon size={28} />
      </div>
      <h1 style={{ fontSize: "1.5rem", margin: "0 0 .75rem" }}>{reason.title}</h1>
      <p style={{ color: "#7e6974", lineHeight: 1.6, margin: "0 0 2rem" }}>{reason.description}</p>
      {params.from && <p style={{ fontSize: 12, color: "#a2939c", marginBottom: 24, wordBreak: "break-all" }}>Đường dẫn: {params.from}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href={reason.cta.href} style={{ display: "inline-flex", alignItems: "center", padding: "0.85rem 1.5rem", borderRadius: 12, background: "linear-gradient(90deg,#b30d59,#8146dc)", color: "#fff", fontWeight: 800, textDecoration: "none" }}>{reason.cta.label}</Link>
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", padding: "0.85rem 1.5rem", borderRadius: 12, border: "1px solid #e2d8dd", color: "#4d253a", fontWeight: 700, textDecoration: "none" }}>Đăng nhập tài khoản khác</Link>
      </div>
    </div>
  </main>;
}
