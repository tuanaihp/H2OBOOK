"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Plus } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { instructorRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type SpaceRow = { id: string; slug: string; title: string; space_type: string; status: string; estimated_minutes: number; active_version_id: string | null; academy_course_lessons: { title: string; module_id: string } | null };
type LessonOption = { id: string; title: string; moduleTitle: string; courseTitle: string; hasSpace: boolean };

export default function BrainStudioPage() {
  const [spaces, setSpaces] = useState<SpaceRow[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [spaceType, setSpaceType] = useState("digital_textbook");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [spacesRes, lessonsRes] = await Promise.all([fetch("/api/learning/spaces"), fetch("/api/learning/lessons")]);
    const spacesJson = await spacesRes.json();
    const lessonsJson = await lessonsRes.json();
    if (spacesRes.ok) { setSpaces(spacesJson.spaces ?? []); setOrganizationId(spacesJson.organizationId ?? ""); }
    if (lessonsRes.ok) setLessons(lessonsJson.lessons ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createSpace() {
    if (!title.trim() || !lessonId) { setError("Chọn bài học và nhập tiêu đề Knowledge Space."); return; }
    setCreating(true); setError(null);
    const res = await fetch("/api/learning/spaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, contentItemId: lessonId, title: title.trim(), spaceType }) });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) { setError(json.error ?? "Không tạo được Knowledge Space."); return; }
    setTitle(""); setLessonId("");
    await load();
  }

  const availableLessons = lessons.filter((lesson) => !lesson.hasSpace);

  return <SimpleOperationsShell title="H2O Brain Studio" subtitle="Knowledge Space Authoring" homeHref="/instructor/brain-studio" routes={instructorRoutes} accentLabel="Brain Content Studio">
    <div className={styles.header}>
      <div><span className={styles.eyebrow}>H2O BRAIN CONTENT STUDIO</span><h1>Knowledge Spaces</h1><p>Mỗi Knowledge Space gắn với đúng 1 bài học trong khóa học — quyền truy cập kế thừa tự động từ quyền của bài học đó (mua lẻ hoặc Membership).</p></div>
    </div>

    <div className={styles.card} style={{ marginBottom: 18 }}>
      <div className={styles.cardHead}><h2>Tạo Knowledge Space mới</h2><p>Chọn 1 bài học chưa có Knowledge Space</p></div>
      <div className={styles.cardBody}>
        {error && <p style={{ color: "#b22949", fontSize: 12, marginTop: 0 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Bài học
            <select value={lessonId} onChange={(event) => setLessonId(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
              <option value="">— Chọn bài học —</option>
              {availableLessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.courseTitle} · {lesson.moduleTitle} · {lesson.title}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tiêu đề Knowledge Space
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Sổ tay tương tác — Buổi 1" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={creating} onClick={createSpace}><Plus size={16} />Tạo mới</button>
        </div>
        <label style={{ display: "grid", gap: 6, fontSize: 11, marginTop: 10, maxWidth: 260 }}>Loại trải nghiệm
          <select value={spaceType} onChange={(event) => setSpaceType(event.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }}>
            {["video_course", "interactive_checklist", "digital_textbook", "resource_vault", "practice_lab", "case_library", "tool_workspace", "assessment"].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
      </div>
    </div>

    <div className={styles.card}>
      <div className={styles.cardHead}><h2>Danh sách Knowledge Space</h2><p>{spaces.length} không gian học</p></div>
      <div className={styles.cardBody}>
        {loading ? <p>Đang tải…</p> : spaces.length === 0 ? (
          <div className={styles.empty}><Brain /><strong>Chưa có Knowledge Space nào</strong><p>Tạo Knowledge Space đầu tiên từ form phía trên.</p></div>
        ) : (
          <div className={styles.list}>
            {spaces.map((space) => (
              <Link key={space.id} href={`/instructor/brain-studio/${space.id}`} className={styles.listItem}>
                <span className={styles.listItemIcon}><Brain size={16} /></span>
                <div><strong>{space.title}</strong><small>{space.academy_course_lessons?.title ?? "—"} · {space.space_type}</small></div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={space.status === "published" ? "success" : "warning"}>{space.status}</span>
                  <em>{space.active_version_id ? "Đã xuất bản" : "Chưa xuất bản"}</em>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  </SimpleOperationsShell>;
}
