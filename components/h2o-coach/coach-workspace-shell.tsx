"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { buildMissionResourceHref } from "@/components/student/reader/context-url";

export interface CoachJourneyItem { id: string; title: string; state: "done" | "current" | "available" | "locked" }
export interface CoachResourceItem { id: string; title: string; resourceType: string; resourceId: string }
export interface CoachMemoryValue { field: string; namespace: string; value: unknown; status: "proposed" | "confirmed" | "rejected"; updatedAt: string }
export interface CoachMessage { id: string; role: "coach" | "learner" | "system"; text: string; createdAt: string }
export interface CoachSchemaField { key: string; label: string; namespace: string }

export interface CoachWorkspaceShellProps {
  missionId: string;
  stageTitle: string;
  missionTitle: string;
  progressPercent: number;
  journeyItems: CoachJourneyItem[];
  resources: CoachResourceItem[];
  memorySchema: CoachSchemaField[];
  initialMemory: CoachMemoryValue[];
  initialMessages: CoachMessage[];
}

function fieldLabel(schema: CoachSchemaField[], field: string): string {
  return schema.find((f) => f.key === field)?.label ?? field;
}
function displayValue(value: unknown): string {
  if (value == null || value === "") return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * Real H2O Coach Workspace — the reference package's HTML/component scaffold
 * (v5/39-H2OBOOK_H2O_COACH_OS_V1/html/H2O_COACH_WORKSPACE_V1.html) wired to
 * /api/student/h2o-coach/turn and /api/student/h2o-coach/memory instead of a hardcoded transcript.
 * Only mounted when a real published Coach profile + Mission coaching config exist (see
 * app/student/missions/[missionId]/page.tsx) — the 4-tab Mission Workspace is always the fallback.
 */
export function CoachWorkspaceShell(props: CoachWorkspaceShellProps) {
  const [messages, setMessages] = useState<CoachMessage[]>(props.initialMessages);
  const [memory, setMemory] = useState<CoachMemoryValue[]>(props.initialMemory);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() { requestAnimationFrame(() => streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight })); }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setError(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "learner", text, createdAt: new Date().toISOString() }]);
    setInput("");
    scrollToBottom();
    const res = await fetch("/api/student/h2o-coach/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: props.missionId, message: text }) });
    const json = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) { setError("Không gửi được tin nhắn — thử lại."); return; }
    setMessages((prev) => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: json.reply, createdAt: new Date().toISOString() }]);
    if (Array.isArray(json.candidates) && json.candidates.length) {
      setMemory((prev) => {
        const next = [...prev];
        for (const c of json.candidates as { field: string; value: unknown; requiresConfirmation: boolean }[]) {
          const idx = next.findIndex((m) => m.field === c.field);
          const entry: CoachMemoryValue = { field: c.field, namespace: c.field.split(".")[0] ?? c.field, value: c.value, status: c.requiresConfirmation ? "proposed" : "confirmed", updatedAt: new Date().toISOString() };
          if (idx >= 0) next[idx] = entry; else next.push(entry);
        }
        return next;
      });
    }
    scrollToBottom();
  }

  async function respondToCandidate(field: string, action: "confirm" | "reject") {
    const current = memory.find((m) => m.field === field);
    setMemory((prev) => prev.map((m) => m.field === field ? { ...m, status: action === "confirm" ? "confirmed" : "rejected" } : m));
    await fetch("/api/student/h2o-coach/memory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, field, value: current?.value }) });
  }

  const pendingConfirmations = memory.filter((m) => m.status === "proposed");
  const confirmedFields = memory.filter((m) => m.status === "confirmed");

  return <div className="h2o-coach-workspace">
    <aside className="h2o-coach-journey">
      <span className="h2o-coach-eyebrow">JOURNEY CONTEXT</span>
      <h2>{props.stageTitle}</h2>
      <div className="h2o-coach-journey-list">
        {props.journeyItems.map((item) => <div key={item.id} className={`h2o-coach-journey-item state-${item.state}`}>
          <small>{item.state === "done" ? "✓ Đã hoàn thành" : item.state === "current" ? "● Bạn đang ở đây" : item.state === "locked" ? "🔒 Chưa mở" : "Chưa bắt đầu"}</small>
          <strong>{item.title}</strong>
        </div>)}
      </div>
      {props.resources.length > 0 && <div className="h2o-coach-journey-resources">
        <span className="h2o-coach-eyebrow">HỌC LIỆU LIÊN QUAN</span>
        {props.resources.map((r) => <Link key={r.id} href={buildMissionResourceHref(r.resourceType, r.resourceId, props.missionId)} className="h2o-coach-resource-link">{r.title} →</Link>)}
      </div>}
    </aside>

    <main className="h2o-coach-chat">
      <header>
        <div><span className="h2o-coach-eyebrow">H2O COACH WORKSPACE</span><h1>{props.missionTitle}</h1></div>
        <div className="h2o-coach-progress"><b>{props.progressPercent}%</b><small>Mission progress</small></div>
      </header>
      <div className="h2o-coach-stream" ref={streamRef}>
        {messages.map((m) => <div key={m.id} className={`h2o-coach-msg role-${m.role}`}>
          <small>{m.role === "coach" ? "H2O Coach" : m.role === "learner" ? "Bạn" : "Hệ thống"}</small>
          <p>{m.text}</p>
        </div>)}
        {pendingConfirmations.map((c) => <div key={c.field} className="h2o-coach-confirm-card">
          <p>H2O hiểu bạn: <b>{fieldLabel(props.memorySchema, c.field)}</b> = {displayValue(c.value)}</p>
          <div><button onClick={() => respondToCandidate(c.field, "confirm")}>Đúng rồi</button><button onClick={() => respondToCandidate(c.field, "reject")}>Chỉnh lại</button></div>
        </div>)}
      </div>
      {error && <p className="h2o-coach-error">{error}</p>}
      <div className="h2o-coach-composer">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nói với H2O về điều bạn đang nghĩ..." disabled={sending} />
        <button onClick={send} disabled={sending || !input.trim()}>{sending ? "Đang gửi…" : "Gửi"}</button>
      </div>
    </main>

    <aside className="h2o-coach-memory">
      <div className="h2o-coach-memory-head"><span className="h2o-coach-eyebrow">H2O BRAIN MEMORY</span><h3>Hồ sơ đang hình thành</h3><p>Dữ liệu chỉ chính thức sau khi bạn xác nhận.</p></div>
      <div className="h2o-coach-memory-list">
        {props.memorySchema.map((field) => {
          const entry = memory.find((m) => m.field === field.key);
          const status = entry?.status;
          return <div key={field.key} className="h2o-coach-memory-field">
            <small>{field.label}</small>
            <strong>{entry && status !== "rejected" ? displayValue(entry.value) || "Chưa xác định" : "Chưa xác định"}</strong>
            <span className={`status-${status ?? "missing"}`}>{status === "confirmed" ? "✓ Đã xác nhận" : status === "proposed" ? "◌ Chờ bạn xác nhận" : "○ H2O sẽ hỏi thêm"}</span>
          </div>;
        })}
      </div>
      {confirmedFields.length === 0 && pendingConfirmations.length === 0 && <p className="h2o-coach-memory-empty">Chưa có dữ liệu nào — hãy bắt đầu trò chuyện.</p>}
    </aside>
  </div>;
}
