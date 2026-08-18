"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { buildMissionResourceHref } from "@/components/student/reader/context-url";

export interface CoachJourneyItem { id: string; title: string; state: "done" | "current" | "available" | "locked" }
export interface CoachResourceItem { id: string; title: string; resourceType: string; resourceId: string }
export interface CoachMemoryValue { field: string; namespace: string; value: unknown; status: "proposed" | "confirmed" | "rejected"; updatedAt: string }
export interface CoachMessage { id: string; role: "coach" | "learner" | "system"; text: string; createdAt: string }
export interface CoachSchemaField { key: string; label: string; namespace: string }
export type CoachMissionState = "in_progress" | "awaiting_confirmation" | "confirmed";

export interface CoachWorkspaceShellProps {
  missionId: string;
  stageTitle: string;
  missionTitle: string;
  initialProgressPercent: number;
  initialMissionState: CoachMissionState;
  /** True once confirmed but the Mission's completion_policy (evidence_required/teacher_verified) still needs a real evidence submission Coach chat cannot provide — see EVIDENCE_HANDOFF_REPLY in service.ts. */
  initialEvidencePending: boolean;
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
function newClientMessageId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Real H2O Coach Workspace, wired to /api/student/h2o-coach/turn and /api/student/h2o-coach/memory.
 * progressPercent/missionState are STATE here, not derived from a static prop — both come from the
 * server's response to every turn (never computed client-side), matching the fix spec's "không để
 * LLM/UI tự quản lý state" rule: this component only ever displays what the server just computed
 * from real learner_memory_values rows.
 */
export function CoachWorkspaceShell(props: CoachWorkspaceShellProps) {
  const [messages, setMessages] = useState<CoachMessage[]>(props.initialMessages);
  const [memory, setMemory] = useState<CoachMemoryValue[]>(props.initialMemory);
  const [progressPercent, setProgressPercent] = useState(props.initialProgressPercent);
  const [missionState, setMissionState] = useState<CoachMissionState>(props.initialMissionState);
  const [evidencePending, setEvidencePending] = useState(props.initialEvidencePending);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() { requestAnimationFrame(() => streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight })); }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setError(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "learner", text: trimmed, createdAt: new Date().toISOString() }]);
    setInput("");
    scrollToBottom();
    const res = await fetch("/api/student/h2o-coach/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: props.missionId, message: trimmed, clientMessageId: newClientMessageId() }) });
    const json = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) { setError("Không gửi được tin nhắn — thử lại."); return; }
    setMessages((prev) => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: json.reply, createdAt: new Date().toISOString() }]);
    setProgressPercent(json.progressPercent ?? progressPercent);
    setMissionState(json.missionState ?? missionState);
    setEvidencePending(Boolean(json.evidencePending));
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
        {props.journeyItems.map((item) => {
          // The currently-open Mission reflects the live Coach state instead of the page-load
          // snapshot — confirming just now flips this to "done" without waiting for a refresh. Not
          // when evidence is still pending though — the Mission genuinely isn't done yet in that case.
          const state = item.id === props.missionId && missionState === "confirmed" && !evidencePending ? "done" : item.state;
          const label = <>
            <small>{state === "done" ? "✓ Đã hoàn thành" : state === "current" ? "● Bạn đang ở đây" : state === "locked" ? "🔒 Chưa mở" : "Chưa bắt đầu"}</small>
            <strong>{item.title}</strong>
          </>;
          const className = `h2o-coach-journey-item state-${state}`;
          // Bug found 2026-08-16: this list rendered as plain <div>s with no navigation at all, unlike
          // the older 4-tab Mission Workspace's sibling rail (mission-workspace-client.tsx) which lets
          // the learner click into any unlocked sibling Mission — a learner who just finished this one
          // had no way to move to the next Mission except editing the URL by hand. The current Mission
          // stays a non-link (there's nowhere useful to navigate to from itself); locked ones stay
          // non-links too since there's nothing to open yet.
          if (item.id === props.missionId || state === "locked") {
            return <div key={item.id} className={className}>{label}</div>;
          }
          return <Link key={item.id} href={`/student/missions/${item.id}`} className={className}>{label}</Link>;
        })}
      </div>
      {props.resources.length > 0 && <div className="h2o-coach-journey-resources">
        <span className="h2o-coach-eyebrow">HỌC LIỆU LIÊN QUAN</span>
        {props.resources.map((r) => <Link key={r.id} href={buildMissionResourceHref(r.resourceType, r.resourceId, props.missionId)} className="h2o-coach-resource-link">{r.title} →</Link>)}
      </div>}
    </aside>

    <main className="h2o-coach-chat">
      <header>
        <div>
          <span className="h2o-coach-eyebrow">H2O COACH WORKSPACE</span><h1>{props.missionTitle}</h1>
          {/* Real gap found 2026-08-17: once a Mission has a Coach config, this screen fully replaces
              the old 4-tab workspace (app/student/missions/[missionId]/page.tsx), so anything only that
              screen offers (evidence upload, daily practice journal, etc.) became unreachable. This link
              is the escape hatch back to it. */}
          <Link href={`/student/missions/${props.missionId}?workspace=classic`} className="h2o-coach-classic-link">Xem giao diện đầy đủ (minh chứng, nhật ký...) →</Link>
        </div>
        <div className="h2o-coach-progress"><b>{progressPercent}%</b><small>{missionState !== "confirmed" ? "Coach progress" : evidencePending ? "Cần nộp minh chứng" : "Đã hoàn thành"}</small></div>
      </header>
      {missionState === "confirmed" && (evidencePending
        ? <div className="h2o-coach-done-banner h2o-coach-done-banner-pending">
            ✓ Đã ghi nhận đủ thông tin — bước cuối: nộp minh chứng thật để chính thức hoàn thành Mission này.
            <Link href={`/student/missions/${props.missionId}?workspace=classic&tab=evidence`} className="h2o-coach-evidence-cta">Đi nộp minh chứng →</Link>
          </div>
        : <div className="h2o-coach-done-banner">✓ Mission này đã hoàn thành — thông tin bên phải là hồ sơ đã xác nhận.</div>)}
      <div className="h2o-coach-stream" ref={streamRef}>
        {messages.map((m, i) => <div key={m.id} className={`h2o-coach-msg role-${m.role}`}>
          <small>{m.role === "coach" ? "H2O Coach" : m.role === "learner" ? "Bạn" : "Hệ thống"}</small>
          <p style={{ whiteSpace: "pre-line" }}>{m.text}</p>
          {/* User asked 2026-08-18: the chatbot should mention relevant document names with real
              links directly in the chat, not just in the side rail. Reuses the exact same
              resourceBindings data already shown in "Học liệu liên quan" (admin attaches these via
              /academy-admin/journey's Mission "2. Học liệu" tab) — surfaced once, on the opening
              message, since resource bindings are Mission-level, not per-question. */}
          {i === 0 && m.role === "coach" && props.resources.length > 0 && <div className="h2o-coach-msg-resources">
            <small>📎 Tài liệu liên quan:</small>
            {props.resources.map((r) => <Link key={r.id} href={buildMissionResourceHref(r.resourceType, r.resourceId, props.missionId)} className="h2o-coach-msg-resource-link">{r.title} →</Link>)}
          </div>}
        </div>)}
        {pendingConfirmations.map((c) => <div key={c.field} className="h2o-coach-confirm-card">
          <p>H2O hiểu bạn: <b>{fieldLabel(props.memorySchema, c.field)}</b> = {displayValue(c.value)}</p>
          <div><button onClick={() => respondToCandidate(c.field, "confirm")}>Đúng rồi</button><button onClick={() => respondToCandidate(c.field, "reject")}>Chỉnh lại</button></div>
        </div>)}
        {missionState === "awaiting_confirmation" && <div className="h2o-coach-confirm-card">
          <p>H2O đã tổng hợp đủ thông tin — xem tin nhắn tóm tắt phía trên.</p>
          <div><button onClick={() => sendText("Đúng rồi")} disabled={sending}>Đúng rồi</button><button onClick={() => sendText("Chỉnh lại")} disabled={sending}>Chỉnh lại</button></div>
        </div>}
      </div>
      {error && <p className="h2o-coach-error">{error}</p>}
      <div className="h2o-coach-composer">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendText(input)} placeholder="Nói với H2O về điều bạn đang nghĩ..." disabled={sending} />
        <button onClick={() => sendText(input)} disabled={sending || !input.trim()}>{sending ? "Đang gửi…" : "Gửi"}</button>
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
