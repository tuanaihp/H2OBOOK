import Link from "next/link";

export type OutputDestination = { label: string; surface: "journey" | "library" | "create" | "business" | "profile" | "credential"; destinationKey: string };

const SURFACE_HREF: Record<OutputDestination["surface"], string> = {
  journey: "/student/courses", library: "/student/library", create: "/student/create",
  business: "/student/business", profile: "/student/profile", credential: "/student/profile"
};
const SURFACE_LABEL: Record<OutputDestination["surface"], string> = {
  journey: "Hành trình", library: "Thư viện", create: "Create", business: "Business", profile: "Hồ sơ / Passport", credential: "Chứng nhận"
};

export function MissionOutputFlow({ items }: { items: OutputDestination[] }) {
  if (!items.length) return null;
  return <div className="h2o-sr-section">
    <h4>Kết quả này sẽ được dùng ở đâu?</h4>
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      {items.map((item) => <Link key={`${item.surface}-${item.destinationKey}`} href={SURFACE_HREF[item.surface]} className="h2o-sr-doc">
        <div className="h2o-sr-docicon">→</div>
        <div><b>{item.label}</b><small>{SURFACE_LABEL[item.surface]}</small></div>
        <span>→</span>
      </Link>)}
    </div>
  </div>;
}
