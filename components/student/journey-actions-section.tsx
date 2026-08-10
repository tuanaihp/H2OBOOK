"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Square } from "lucide-react";

type JourneyAction = { id: string; mission_id: string | null; source_type: string; title: string; status: string; due_date: string | null };

// Actions Start Mission created (lib/learn-outcome/student.ts) — Tab 4 needs to read these too, not
// only show them inside the Mission Drawer they came from (docs/learn-outcome-os Release B §10).
// Renders nothing when there are none, so it never inserts an empty "Journey" section into a page
// that otherwise has no mission actions yet.
export function JourneyActionsSection() {
  const [actions, setActions] = useState<JourneyAction[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/student/journey/actions", { cache: "no-store" }).then((r) => r.json()).then((json) => setActions(json?.actions ?? [])).catch(() => setActions([]));
  }, []);

  async function toggle(actionId: string, done: boolean) {
    setBusy(true);
    await fetch("/api/student/journey/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId, status: done ? "completed" : "planned" }) });
    const res = await fetch("/api/student/journey/actions", { cache: "no-store" });
    setActions((await res.json().catch(() => null))?.actions ?? []);
    setBusy(false);
  }

  if (!actions?.length) return null;
  return <section className="h2o-student-card" style={{ marginBottom: 20 }}>
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Hành động từ Journey Map</strong>
        <Link href="/student/courses" style={{ fontSize: 11, color: "#2563eb" }}>Xem Journey Map</Link>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {actions.map((a) => <label key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, cursor: busy ? "default" : "pointer" }}>
          <button type="button" disabled={busy} onClick={() => toggle(a.id, a.status !== "completed")} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
            {a.status === "completed" ? <CheckSquare size={14} color="#16a34a" /> : <Square size={14} color="#94a3b8" />}
          </button>
          <span style={{ textDecoration: a.status === "completed" ? "line-through" : "none", color: a.status === "completed" ? "#94a3b8" : "#0f172a" }}>{a.title}</span>
        </label>)}
      </div>
    </div>
  </section>;
}
