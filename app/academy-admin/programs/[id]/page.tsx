"use client";
import { useEffect, useState, use as usePromise } from "react";
import { BookOpenCheck, Plus } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type Lesson = { id: string; title: string; description: string; durationSeconds: number; videoUrl: string | null; status: string; isPreview: boolean };
type ModuleRow = { id: string; title: string; description: string; status: string; lessons: Lesson[] };
type CourseDetail = { id: string; title: string; subtitle: string; description: string; category: string; level: string; status: string; price: number; modules: ModuleRow[] };

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newLessonTitle, setNewLessonTitle] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/academy-admin/courses/${id}`);
    const json = await res.json();
    if (res.ok) setCourse(json.course);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function saveCourseField(field: string, value: string) {
    await fetch(`/api/academy-admin/courses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
  }

  async function toggleCourseStatus() {
    if (!course) return;
    const nextStatus = course.status === "active" ? "hidden" : "active";
    await fetch(`/api/academy-admin/courses/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    await load();
  }

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    await fetch(`/api/academy-admin/courses/${id}/modules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newModuleTitle }) });
    setNewModuleTitle("");
    await load();
  }

  async function toggleModuleStatus(moduleId: string, status: string) {
    await fetch(`/api/academy-admin/modules/${moduleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status === "published" ? "draft" : "published" }) });
    await load();
  }

  async function addLesson(moduleId: string) {
    const title = newLessonTitle[moduleId];
    if (!title?.trim()) return;
    await fetch(`/api/academy-admin/modules/${moduleId}/lessons`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    setNewLessonTitle((prev) => ({ ...prev, [moduleId]: "" }));
    await load();
  }

  async function toggleLessonStatus(lessonId: string, status: string) {
    await fetch(`/api/academy-admin/lessons/${lessonId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status === "published" ? "draft" : "published" }) });
    await load();
  }

  if (loading || !course) {
    return <SimpleOperationsShell title="Academy Control Center" subtitle="Chương trình đào tạo" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin"><p>Đang tải…</p></SimpleOperationsShell>;
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Chương trình đào tạo" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>KHÓA HỌC</span>
        <input defaultValue={course.title} onBlur={(e) => saveCourseField("title", e.target.value)} style={{ font: "inherit", fontSize: 30, fontWeight: 800, border: "none", outline: "none", background: "transparent", padding: 0, margin: "8px 0" }} />
        <textarea defaultValue={course.description} onBlur={(e) => saveCourseField("description", e.target.value)} placeholder="Mô tả khóa học…" style={{ display: "block", width: "100%", maxWidth: 700, border: "1px solid #edf0f2", borderRadius: 10, padding: 10, fontSize: 12 }} />
      </div>
      <div className={styles.headerActions}>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={toggleCourseStatus}>{course.status === "active" ? "Ẩn khóa học" : "Kích hoạt khóa học"}</button>
      </div>
    </header>

    <section className={styles.card} style={{ marginBottom: 18 }}>
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Thêm module mới
          <input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Tên module" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
        </label>
        <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={addModule}><Plus size={14} />Thêm module</button>
      </div>
    </section>

    {course.modules.map((module) => (
      <section key={module.id} className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles.cardHead}>
          <div><h2>{module.title}</h2><p>{module.lessons.length} bài học</p></div>
          <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => toggleModuleStatus(module.id, module.status)}>{module.status === "published" ? "Ẩn module" : "Xuất bản module"}</button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.list}>
            {module.lessons.map((lesson) => (
              <div key={lesson.id} className={styles.listItem}>
                <span className={styles.listItemIcon}><BookOpenCheck size={16} /></span>
                <div><strong>{lesson.title}</strong><small>{lesson.videoUrl ? "Có video" : "Chưa có video"}</small></div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={lesson.status === "published" ? "success" : "warning"}>{lesson.status}</span>
                  <button style={{ display: "block", marginTop: 4, fontSize: 9, border: "none", background: "none", color: "#0c6e86", cursor: "pointer" }} onClick={() => toggleLessonStatus(lesson.id, lesson.status)}>{lesson.status === "published" ? "Ẩn" : "Xuất bản"}</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 12 }}>
            <input value={newLessonTitle[module.id] ?? ""} onChange={(e) => setNewLessonTitle((prev) => ({ ...prev, [module.id]: e.target.value }))} placeholder="Tên bài học mới" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
            <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => addLesson(module.id)}><Plus size={14} />Thêm bài học</button>
          </div>
        </div>
      </section>
    ))}
  </SimpleOperationsShell>;
}
