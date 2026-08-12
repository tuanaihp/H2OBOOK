// "H2O đã biết gì về bạn?" — docs/stage1-learning-os-v1. Styled with the same h2o-sr-* classes as
// the rest of Mission Workspace (components/student/mission-workspace/mission-workspace-client.tsx),
// not the source package's Tailwind reference markup — this app's student surfaces use one CSS
// system, not two.
export type KnownFact = { label: string; value: string; sourceMissionId: string | null; sourceMissionTitle: string | null };

export function MissionKnownContext({ facts }: { facts: KnownFact[] }) {
  if (!facts.length) return null;
  return <div className="h2o-sr-section" style={{ background: "#f0fbfd", border: "1px solid #bfe9f0" }}>
    <h4>H2O đã biết gì về bạn?</h4>
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      {facts.map((f, i) => <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 11, color: "#718092" }}>{f.label}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
      </div>)}
    </div>
    <p style={{ fontSize: 11, color: "#718092", margin: "8px 0 0" }}>Dữ liệu được tái sử dụng từ nhiệm vụ trước; bạn không cần nhập lại.</p>
  </div>;
}
