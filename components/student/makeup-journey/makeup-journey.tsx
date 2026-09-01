"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, ImagePlus, Sparkles, X } from "lucide-react";
import { uploadAsset, resolveAssetUrl } from "@/lib/assets/asset-client";
import { SESSION_TYPE_LABEL, type SessionType } from "@/lib/student-competency/types";
import styles from "./makeup-journey.module.css";

// ---------------------------------------------------------------------------
// Shapes mirror lib/student-competency/service.ts::getOwnClassJourney (ClassJourney).
// ---------------------------------------------------------------------------
type SessionStatus = "scheduled" | "completed" | "cancelled";
interface ClassSession { id: string; sessionNo: number; sessionType: SessionType; title: string; sessionDate: string | null; status: SessionStatus }
interface RubricCriterion { id: string; title: string; description: string; maxScore: number; required: boolean }
interface Rubric { id: string; title: string; category: "training" | "makeup" | "hair" | null; criteria: RubricCriterion[] }
interface Evaluation { classSessionId: string; totalScore: number; maxScore: number; criterionScores: Record<string, number>; notes: string; assetIds: string[]; updatedAt: string }
interface Submission { classSessionId: string; assetIds: string[]; note: string; updatedAt: string }
interface Journey {
  class: { id: string; name: string; code: string; status: string; totalSessions: number; startedAt: string | null };
  sessions: ClassSession[];
  evaluations: Evaluation[];
  submissions: Submission[];
  rubrics: Rubric[];
}

const MAX_EVIDENCE = 6;

export type JourneyView = "schedule" | "training" | "practice" | "hair";

const VIEWS: { key: JourneyView; label: string; href: string }[] = [
  { key: "schedule", label: "Lịch học", href: "/student/makeup-journey" },
  { key: "training", label: "Học training", href: "/student/makeup-journey/training" },
  { key: "practice", label: "Học thực hành", href: "/student/makeup-journey/practice" },
  { key: "hair", label: "Bới tóc", href: "/student/makeup-journey/hair" }
];

const VIEW_META: Record<JourneyView, { title: string; sub: string; types: SessionType[] | null }> = {
  schedule: { title: "Lịch học", sub: "Toàn bộ các buổi của chương trình, xếp theo lịch.", types: null },
  training: { title: "Học training", sub: "Các buổi Training Makeup & Tóc — quan sát, nghe giảng, ghi chép.", types: ["training_makeup_hair"] },
  practice: { title: "Học thực hành", sub: "Các buổi thực hành Makeup & Tóc trên mẫu.", types: ["practice_makeup_hair"] },
  hair: { title: "Bới tóc", sub: "Các buổi Training Tóc và thực hành Tóc.", types: ["training_hair", "practice_hair"] }
};

const CATEGORY_FOR_TYPE: Record<SessionType, "training" | "makeup" | "hair" | "extra"> = {
  training_makeup_hair: "training",
  training_hair: "training",
  practice_makeup_hair: "makeup",
  practice_hair: "hair",
  extracurricular: "extra"
};
const RUBRIC_FOR_TYPE: Partial<Record<SessionType, "training" | "makeup" | "hair">> = {
  training_makeup_hair: "training", training_hair: "training",
  practice_makeup_hair: "makeup", practice_hair: "hair"
};
const SESSION_TYPE_SHORT: Record<SessionType, string> = {
  training_makeup_hair: "Training M&T",
  training_hair: "Training Tóc",
  practice_makeup_hair: "TH Makeup",
  practice_hair: "TH Tóc",
  extracurricular: "Ngoại khóa"
};
const SESSION_STATUS_LABEL: Record<SessionStatus, string> = { scheduled: "Chưa diễn ra", completed: "Đã học", cancelled: "Đã huỷ" };
const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// --- date helpers (no external dep) ---------------------------------------
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const isoKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("T")[0].split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const fmtDate = (d: Date) => d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

function pct(score: number, max: number) {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

// =========================================================================
export function MakeupJourney({ view }: { view: JourneyView }) {
  const [journey, setJourney] = useState<Journey | null | undefined>(undefined);
  const [mode, setMode] = useState<"demo" | "production" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/student/makeup-journey", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { mode?: "demo" | "production"; journey?: Journey | null } | null;
    setMode(payload?.mode ?? null);
    setJourney(payload?.journey ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const onSubmissionSaved = useCallback((next: Submission) => {
    setJourney((current) => {
      if (!current) return current;
      const rest = current.submissions.filter((s) => s.classSessionId !== next.classSessionId);
      return { ...current, submissions: [...rest, next] };
    });
  }, []);

  const meta = VIEW_META[view];

  const head = (
    <section className="h2o-student-page-head">
      <div>
        <span>CHƯƠNG TRÌNH ĐÀO TẠO · {meta.title.toUpperCase()}</span>
        <h1>Chương trình đào tạo</h1>
        <p>{meta.sub}</p>
      </div>
    </section>
  );

  const viewNav = (
    <nav className={styles.viewNav}>
      {VIEWS.map((v) => (
        <Link key={v.key} href={v.href} data-active={v.key === view}>{v.label}</Link>
      ))}
    </nav>
  );

  if (journey === undefined) return <>{head}{viewNav}<p className={styles.muted}>Đang tải chương trình…</p></>;

  if (mode === "demo") {
    return <>{head}
      <div className={styles.notice}><Sparkles size={16} /><div><strong>Chế độ demo</strong><p>Đăng nhập bằng tài khoản học viên thật để xem chương trình đào tạo của bạn.</p></div></div>
    </>;
  }

  if (!journey) {
    return <>{head}
      <section className={styles.emptyCard}>
        <GraduationCap size={34} />
        <h2>Bạn chưa được ghi danh vào lớp nào</h2>
        <p>Khi giảng viên hoặc Academy thêm bạn vào một lớp Makeup Chuyên nghiệp, toàn bộ chương trình 60 buổi sẽ hiện ở đây theo lịch, kèm chỗ nộp minh chứng cho từng buổi.</p>
        <Link href="/student/courses" className="h2o-student-primary">Về trang khóa học</Link>
      </section>
    </>;
  }

  const { class: klass, sessions, evaluations } = journey;
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const gradedPercents = evaluations.filter((e) => e.maxScore > 0).map((e) => pct(e.totalScore, e.maxScore));
  const avgScore = gradedPercents.length ? Math.round(gradedPercents.reduce((a, b) => a + b, 0) / gradedPercents.length) : null;

  return <>{head}{viewNav}

    <section className={styles.classBar}>
      <div>
        <strong>{klass.name}</strong>
        <span>Mã lớp {klass.code} · {klass.totalSessions} buổi</span>
      </div>
      <div className={styles.classMetrics}>
        <span><b>{completedCount}</b>/{klass.totalSessions} buổi đã học</span>
        <span><b>{evaluations.length}</b> buổi đã chấm</span>
        <span><b>{avgScore === null ? "—" : `${avgScore}%`}</b> điểm trung bình</span>
      </div>
    </section>

    <CurriculumCalendar journey={journey} view={view} onSubmissionSaved={onSubmissionSaved} />
  </>;
}

// =========================================================================
type CalItem = { session: ClassSession; date: Date | null; synthetic: boolean };

function CurriculumCalendar({ journey, view, onSubmissionSaved }: {
  journey: Journey; view: JourneyView; onSubmissionSaved: (s: Submission) => void;
}) {
  const evaluationBySession = useMemo(() => new Map(journey.evaluations.map((e) => [e.classSessionId, e])), [journey.evaluations]);
  const submissionBySession = useMemo(() => new Map(journey.submissions.map((s) => [s.classSessionId, s])), [journey.submissions]);
  const rubricByCategory = useMemo(() => new Map(journey.rubrics.map((r) => [r.category, r])), [journey.rubrics]);

  const hasRealDates = useMemo(() => journey.sessions.some((s) => s.sessionDate), [journey.sessions]);

  const anchor = useMemo(() => {
    const d = journey.class.startedAt ? new Date(journey.class.startedAt) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : startOfDay(d);
  }, [journey.class.startedAt]);
  const synthDate = useCallback((sessionNo: number) => {
    let d = addDays(anchor, (sessionNo - 1) * 2);
    if (d.getDay() === 0) d = addDays(d, 1); // avoid Sunday
    return d;
  }, [anchor]);

  const types = VIEW_META[view].types;
  const items: CalItem[] = useMemo(() => {
    const list = types === null ? journey.sessions : journey.sessions.filter((s) => types.includes(s.sessionType));
    return list.map((session) => {
      if (session.sessionDate) return { session, date: parseDateOnly(session.sessionDate), synthetic: false };
      if (!hasRealDates) return { session, date: synthDate(session.sessionNo), synthetic: true };
      return { session, date: null, synthetic: false };
    });
  }, [journey.sessions, types, hasRealDates, synthDate]);

  const dated = useMemo(() => items.filter((i) => i.date), [items]);
  const undated = useMemo(() => items.filter((i) => !i.date), [items]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const it of dated) {
      const key = isoKey(it.date!);
      const list = map.get(key);
      if (list) list.push(it);
      else map.set(key, [it]);
    }
    for (const list of map.values()) list.sort((a, b) => a.session.sessionNo - b.session.sessionNo);
    return map;
  }, [dated]);

  const [month, setMonth] = useState<Date>(() => {
    const first = dated.map((i) => i.date!.getTime()).sort((a, b) => a - b)[0];
    return startOfMonth(first ? new Date(first) : new Date());
  });
  const [drawer, setDrawer] = useState<{ label: string; note?: string; sessions: ClassSession[] } | null>(null);

  const gridStart = useMemo(() => {
    const som = startOfMonth(month);
    return addDays(som, -((som.getDay() + 6) % 7));
  }, [month]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const todayKey = isoKey(new Date());

  const openDay = (day: Date) => {
    const dayItems = itemsByDay.get(isoKey(day)) ?? [];
    if (!dayItems.length) return;
    setDrawer({ label: fmtDate(day), sessions: dayItems.map((i) => i.session), note: dayItems[0].synthetic ? "Ngày dự kiến — giảng viên chưa xếp lịch chính thức." : undefined });
  };

  const detailProps = (session: ClassSession) => ({
    session,
    rubric: rubricByCategory.get(RUBRIC_FOR_TYPE[session.sessionType] ?? null) ?? null,
    evaluation: evaluationBySession.get(session.id) ?? null,
    submission: submissionBySession.get(session.id) ?? null,
    onSaved: onSubmissionSaved
  });

  return <div className={styles.calWrap}>
    {!hasRealDates && dated.length > 0 && (
      <p className={styles.calHint}>Lịch đang hiển thị <b>theo dự kiến</b> (mỗi 2 ngày từ lúc mở lớp). Khi giảng viên xếp lịch chính thức, ngày sẽ tự cập nhật.</p>
    )}

    <div className={styles.calCard}>
      <div className={styles.calHead}>
        <div className={styles.calNav}>
          <button type="button" aria-label="Tháng trước" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft size={16} /></button>
          <strong>{month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong>
          <button type="button" aria-label="Tháng sau" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight size={16} /></button>
        </div>
        <button type="button" className={styles.todayBtn} onClick={() => setMonth(startOfMonth(new Date()))}>Hôm nay</button>
      </div>

      <div className={styles.legend}>
        <span data-cat="training">Training</span>
        <span data-cat="makeup">Thực hành Makeup</span>
        <span data-cat="hair">Tóc</span>
        <span data-cat="extra">Ngoại khóa</span>
      </div>

      <div className={styles.calGrid}>
        {DOW.map((d) => <div key={d} className={styles.dow}>{d}</div>)}
        {cells.map((day) => {
          const key = isoKey(day);
          const dayItems = itemsByDay.get(key) ?? [];
          const inMonth = day.getMonth() === month.getMonth();
          return (
            <button
              key={key}
              type="button"
              className={styles.cell}
              data-outside={!inMonth || undefined}
              data-today={key === todayKey || undefined}
              data-has={dayItems.length ? "" : undefined}
              onClick={() => openDay(day)}
            >
              <span className={styles.cellDate}>{day.getDate()}</span>
              <span className={styles.cellChips}>
                {dayItems.slice(0, 3).map((it) => {
                  const ev = evaluationBySession.get(it.session.id);
                  const sub = submissionBySession.get(it.session.id);
                  return <span
                    key={it.session.id}
                    className={styles.chip}
                    data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}
                    data-graded={ev ? "" : undefined}
                    data-sub={!ev && (sub?.assetIds.length ?? 0) > 0 ? "" : undefined}
                  >
                    B{it.session.sessionNo} · {SESSION_TYPE_SHORT[it.session.sessionType]}
                    {ev ? ` · ${ev.totalScore}` : ""}
                  </span>;
                })}
                {dayItems.length > 3 && <span className={styles.chipMore}>+{dayItems.length - 3} buổi</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>

    {hasRealDates && undated.length > 0 && (
      <div className={styles.undated}>
        <div className={styles.undatedHead}>Chưa xếp lịch · {undated.length} buổi</div>
        <div className={styles.undatedRow}>
          {undated.sort((a, b) => a.session.sessionNo - b.session.sessionNo).map((it) => {
            const ev = evaluationBySession.get(it.session.id);
            return <button
              key={it.session.id}
              type="button"
              className={styles.chip}
              data-cat={CATEGORY_FOR_TYPE[it.session.sessionType]}
              data-graded={ev ? "" : undefined}
              onClick={() => setDrawer({ label: `Buổi ${it.session.sessionNo} · ${SESSION_TYPE_LABEL[it.session.sessionType]}`, sessions: [it.session] })}
            >
              B{it.session.sessionNo} · {SESSION_TYPE_SHORT[it.session.sessionType]}{ev ? ` · ${ev.totalScore}` : ""}
            </button>;
          })}
        </div>
      </div>
    )}

    {items.length === 0 && <p className={styles.muted}>Chưa có buổi nào thuộc nhóm này. Giảng viên sẽ bổ sung vào lịch.</p>}

    {drawer && (
      <>
        <div className={styles.backdrop} onClick={() => setDrawer(null)} />
        <aside className={styles.drawer} role="dialog" aria-label={drawer.label}>
          <div className={styles.drawerHead}>
            <div>
              <strong>{drawer.label}</strong>
              {drawer.note && <small>{drawer.note}</small>}
            </div>
            <button type="button" aria-label="Đóng" onClick={() => setDrawer(null)}><X size={16} /></button>
          </div>
          <div className={styles.drawerBody}>
            {drawer.sessions.map((session, idx) =>
              drawer.sessions.length > 1
                ? <details key={session.id} className={styles.detailFold} open={idx === 0}>
                    <summary>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</summary>
                    <SessionDetail {...detailProps(session)} />
                  </details>
                : <SessionDetail key={session.id} {...detailProps(session)} />
            )}
          </div>
        </aside>
      </>
    )}
  </div>;
}

// =========================================================================
function SessionDetail({ session, rubric, evaluation, submission, onSaved }: {
  session: ClassSession;
  rubric: Rubric | null;
  evaluation: Evaluation | null;
  submission: Submission | null;
  onSaved: (next: Submission) => void;
}) {
  return <div className={styles.detail}>
    <div className={styles.detailHead}>
      <strong>Buổi {session.sessionNo} · {SESSION_TYPE_LABEL[session.sessionType]}</strong>
      <span className={styles.pill} data-tone={session.status === "completed" ? "done" : session.status === "cancelled" ? "off" : undefined}>
        {SESSION_STATUS_LABEL[session.status]}
      </span>
    </div>
    {session.title && <p className={styles.detailTitle}>{session.title}</p>}

    <SessionEvidence sessionId={session.id} submission={submission} locked={Boolean(evaluation)} onSaved={onSaved} />

    {evaluation
      ? <GradePanel evaluation={evaluation} rubric={rubric} />
      : <div className={styles.pendingPanel}>
          <span className={styles.pendingTag}>Chưa chấm</span>
          {rubric && rubric.criteria.length > 0
            ? <>
                <p>Giảng viên sẽ chấm dựa trên minh chứng bạn nộp và các tiêu chí sau:</p>
                <ul className={styles.criteriaList}>
                  {rubric.criteria.map((c) => (
                    <li key={c.id}><span>{c.title}</span><b>/ {c.maxScore}{c.required ? " · bắt buộc" : ""}</b></li>
                  ))}
                </ul>
              </>
            : <p>Buổi này chưa gắn bộ tiêu chí chấm.</p>}
        </div>}
  </div>;
}

function SessionEvidence({ sessionId, submission, locked, onSaved }: {
  sessionId: string;
  submission: Submission | null;
  locked: boolean;
  onSaved: (next: Submission) => void;
}) {
  const [assetIds, setAssetIds] = useState<string[]>(submission?.assetIds ?? []);
  const [note, setNote] = useState(submission?.note ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssetIds(submission?.assetIds ?? []);
    setNote(submission?.note ?? "");
  }, [submission]);

  const dirty = note !== (submission?.note ?? "") ||
    assetIds.length !== (submission?.assetIds.length ?? 0) ||
    assetIds.some((id, i) => id !== submission?.assetIds[i]);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const room = MAX_EVIDENCE - assetIds.length;
    if (room <= 0) { setMessage(`Tối đa ${MAX_EVIDENCE} ảnh.`); return; }
    setUploading(true); setMessage(null);
    try {
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const asset = await uploadAsset(file, { category: "student-competency", assetType: "image", compress: true });
        setAssetIds((current) => [...current, asset.assetId]);
      }
    } catch {
      setMessage("Tải ảnh thất bại — thử lại.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/student/makeup-journey/submission", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classSessionId: sessionId, assetIds, note })
      });
      const payload = await response.json().catch(() => null) as { error?: string; submission?: Submission } | null;
      if (!response.ok || !payload?.submission) {
        setMessage(payload?.error === "STUDENT_NOT_IN_CLASS" ? "Bạn không còn trong lớp này." : "Không lưu được minh chứng.");
        return;
      }
      onSaved(payload.submission);
      setMessage("Đã lưu minh chứng.");
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.evidence}>
    <div className={styles.evidenceHead}>
      <span>Minh chứng của bạn {locked && <em>· đã khoá vì buổi đã được chấm</em>}</span>
    </div>
    <div className={styles.thumbRow}>
      {assetIds.map((id) => (
        <span key={id} className={styles.thumb}>
          <AssetThumb assetId={id} />
          {!locked && <button type="button" aria-label="Bỏ ảnh này" onClick={() => setAssetIds((v) => v.filter((x) => x !== id))}><X size={12} /></button>}
        </span>
      ))}
      {!locked && assetIds.length < MAX_EVIDENCE && (
        <label className={styles.addThumb}>
          <ImagePlus size={16} />{uploading ? "Đang tải…" : "Thêm ảnh"}
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={onPick} hidden />
        </label>
      )}
      {assetIds.length === 0 && locked && <span className={styles.muted}>Không có ảnh nào được nộp cho buổi này.</span>}
    </div>
    {!locked && <textarea
      className={styles.note}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      rows={2}
      maxLength={500}
      placeholder="Ghi chú ngắn: makeup gì, cho ai, dùng kỹ thuật nào…"
    />}
    {locked && note && <p className={styles.lockedNote}>{note}</p>}
    {!locked && <div className={styles.evidenceActions}>
      <button type="button" className="h2o-student-primary" disabled={saving || uploading || !dirty} onClick={save}>
        {saving ? "Đang lưu…" : "Lưu minh chứng"}
      </button>
      {message && <span className={styles.message}>{message}</span>}
    </div>}
    {locked && message && <span className={styles.message}>{message}</span>}
  </div>;
}

function GradePanel({ evaluation, rubric }: { evaluation: Evaluation; rubric: Rubric | null }) {
  const percent = pct(evaluation.totalScore, evaluation.maxScore);
  return <div className={styles.gradePanel}>
    <div className={styles.gradeTop}>
      <div>
        <span>Điểm giảng viên</span>
        <strong>{evaluation.totalScore}<i>/{evaluation.maxScore}</i></strong>
      </div>
      <span className={styles.pill} data-tone={percent >= 90 ? "done" : percent >= 70 ? "info" : "warn"}>{percent}%</span>
    </div>

    {rubric && rubric.criteria.length > 0 && (
      <ul className={styles.criteriaList}>
        {rubric.criteria.map((c) => {
          const s = evaluation.criterionScores[c.id] ?? 0;
          return <li key={c.id}>
            <span>{c.title}</span>
            <b data-low={s < c.maxScore * 0.6 ? "" : undefined}>{s} / {c.maxScore}</b>
          </li>;
        })}
      </ul>
    )}

    {evaluation.notes && <p className={styles.gradeNotes}>{evaluation.notes}</p>}

    {evaluation.assetIds.length > 0 && <div className={styles.thumbRow}>
      {evaluation.assetIds.map((id) => <span key={id} className={styles.thumb}><AssetThumb assetId={id} /></span>)}
    </div>}
  </div>;
}

function AssetThumb({ assetId }: { assetId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUrl(assetId).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [assetId]);
  if (!url) return <span className={styles.thumbPlaceholder}><CheckCircle2 size={14} /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Minh chứng" /></a>;
}
