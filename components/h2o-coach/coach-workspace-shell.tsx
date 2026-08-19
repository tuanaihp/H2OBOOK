"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { buildMissionResourceHref } from "@/components/student/reader/context-url";

/** H2O Brain avatar — the same neural-sphere motif as the "H2O BRAIN MEMORY" panel, given a visual
 * presence in the chat itself instead of only naming it in a heading. Pure inline SVG (no external
 * asset, no emoji-as-icon), so it themes with CSS and never blurs. */
function CoachBrainAvatar({ size = 38, thinking = false }: { size?: number; thinking?: boolean }) {
  return <span className={`h2o-coach-avatar${thinking ? " is-thinking" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width={Math.round(size * 0.52)} height={Math.round(size * 0.52)} fill="none">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="5.5" cy="7" r="1.4" fill="currentColor" opacity=".85" />
      <circle cx="18.5" cy="7" r="1.4" fill="currentColor" opacity=".85" />
      <circle cx="5.5" cy="17" r="1.4" fill="currentColor" opacity=".85" />
      <circle cx="18.5" cy="17" r="1.4" fill="currentColor" opacity=".85" />
      <circle cx="12" cy="4" r="1.2" fill="currentColor" opacity=".7" />
      <circle cx="12" cy="20" r="1.2" fill="currentColor" opacity=".7" />
      <path d="M12 12 5.5 7M12 12 18.5 7M12 12 5.5 17M12 12 18.5 17M12 12 12 4M12 12 12 20" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
    </svg>
    <i />
  </span>;
}

/** "Đang suy nghĩ" bubble — a proper messenger typing indicator styled as firing neurons rather than
 * generic dots, shown while waiting on /api/student/h2o-coach/turn instead of only disabling the send
 * button. Respects prefers-reduced-motion (see .h2o-coach-neuron-pulse in globals.css). */
function CoachThinkingBubble() {
  return <div className="h2o-coach-msg role-coach h2o-coach-thinking-msg">
    <CoachBrainAvatar size={28} thinking />
    <div className="h2o-coach-neuron-pulse"><span /><span /><span /></div>
  </div>;
}

let heartSeed = 0;
/** Floating-heart burst — fired when the student's answer just became confirmed data (a "decision"
 * locked in), so confirming feels warm and celebrated rather than just a status flip. Pure CSS
 * animation (transform+opacity only), self-removing, hidden under prefers-reduced-motion. */
function CoachHeartBurst({ hearts }: { hearts: { id: number; left: number; delay: number; scale: number }[] }) {
  if (!hearts.length) return null;
  return <div className="h2o-coach-hearts" aria-hidden="true">
    {hearts.map((h) => <svg key={h.id} className="h2o-coach-heart" viewBox="0 0 24 24" width={16} height={16} fill="currentColor"
      style={{ left: `${h.left}%`, animationDelay: `${h.delay}ms`, ["--h2o-heart-scale" as string]: h.scale }}>
      <path d="M12 21s-7.5-4.6-10-9.1C.4 8.6 2 5 5.6 5c2 0 3.4 1.1 4.4 2.6C11 6.1 12.4 5 14.4 5 18 5 19.6 8.6 22 11.9 19.5 16.4 12 21 12 21Z" />
    </svg>)}
  </div>;
}

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
  const [hearts, setHearts] = useState<{ id: number; left: number; delay: number; scale: number }[]>([]);
  const streamRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() { requestAnimationFrame(() => streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight })); }

  // A confirmed value is a decision the student just made and committed to — celebrate it lightly
  // rather than only flipping a status label. `big` = the whole Mission just got confirmed. `side`
  // biases where the hearts rise from: "right" hugs the learner's own bubble (right-aligned, see
  // .h2o-coach-msg.role-learner) for the instant "message sent" burst; "center" is the default for
  // confirm/mission-complete moments, which aren't tied to one specific bubble.
  function burstHearts(count: number, opts: { big?: boolean; side?: "center" | "right" } = {}) {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const [min, span] = opts.side === "right" ? [58, 30] : [30, 40];
    const created = Array.from({ length: count }, () => ({ id: heartSeed++, left: min + Math.random() * span, delay: Math.random() * 220, scale: opts.big ? 1.15 + Math.random() * 0.5 : 0.75 + Math.random() * 0.4 }));
    setHearts((prev) => [...prev, ...created]);
    setTimeout(() => setHearts((prev) => prev.filter((h) => !created.includes(h))), 1900);
  }

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setError(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "learner", text: trimmed, createdAt: new Date().toISOString() }]);
    setInput("");
    // Admin asked 2026-08-19: hearts should rise the moment the student replies, not only once the
    // server confirms a value — an immediate, low-cost "your voice was heard" moment near their own
    // bubble, on top of (not instead of) the bigger confirm/mission-complete bursts below.
    burstHearts(1, { side: "right" });
    scrollToBottom();
    const res = await fetch("/api/student/h2o-coach/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ missionId: props.missionId, message: trimmed, clientMessageId: newClientMessageId() }) });
    const json = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) { setError("Không gửi được tin nhắn — thử lại."); return; }
    setMessages((prev) => [...prev, { id: `coach-${Date.now()}`, role: "coach", text: json.reply, createdAt: new Date().toISOString() }]);
    const wasConfirmed = missionState === "confirmed";
    setProgressPercent(json.progressPercent ?? progressPercent);
    setMissionState(json.missionState ?? missionState);
    setEvidencePending(Boolean(json.evidencePending));
    if (Array.isArray(json.candidates) && json.candidates.length) {
      const newlyConfirmed = (json.candidates as { requiresConfirmation: boolean }[]).filter((c) => !c.requiresConfirmation).length;
      setMemory((prev) => {
        const next = [...prev];
        for (const c of json.candidates as { field: string; value: unknown; requiresConfirmation: boolean }[]) {
          const idx = next.findIndex((m) => m.field === c.field);
          const entry: CoachMemoryValue = { field: c.field, namespace: c.field.split(".")[0] ?? c.field, value: c.value, status: c.requiresConfirmation ? "proposed" : "confirmed", updatedAt: new Date().toISOString() };
          if (idx >= 0) next[idx] = entry; else next.push(entry);
        }
        return next;
      });
      if (json.missionState === "confirmed" && !wasConfirmed) burstHearts(7, { big: true });
      else if (newlyConfirmed > 0) burstHearts(Math.min(newlyConfirmed, 3));
    }
    scrollToBottom();
  }

  async function respondToCandidate(field: string, action: "confirm" | "reject") {
    const current = memory.find((m) => m.field === field);
    setMemory((prev) => prev.map((m) => m.field === field ? { ...m, status: action === "confirm" ? "confirmed" : "rejected" } : m));
    if (action === "confirm") burstHearts(2);
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
      <CoachHeartBurst hearts={hearts} />
      <header>
        <div className="h2o-coach-headline">
          <CoachBrainAvatar />
          <div>
            <span className="h2o-coach-eyebrow">H2O COACH WORKSPACE</span><h1>{props.missionTitle}</h1>
            {/* Real gap found 2026-08-17: once a Mission has a Coach config, this screen fully replaces
                the old 4-tab workspace (app/student/missions/[missionId]/page.tsx), so anything only that
                screen offers (evidence upload, daily practice journal, etc.) became unreachable. This link
                is the escape hatch back to it. */}
            <Link href={`/student/missions/${props.missionId}?workspace=classic`} className="h2o-coach-classic-link">Xem giao diện đầy đủ (minh chứng, nhật ký...) →</Link>
          </div>
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
          {m.role === "coach" && <CoachBrainAvatar size={28} />}
          <div className="h2o-coach-msg-body">
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
          </div>
        </div>)}
        {sending && <CoachThinkingBubble />}
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
