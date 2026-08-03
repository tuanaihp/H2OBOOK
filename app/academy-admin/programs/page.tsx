"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Plus } from "lucide-react";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { academyAdminRoutes } from "@/lib/operations/routes";
import styles from "@/components/operations/operations.module.css";

type CourseSummary = { id: string; slug: string; title: string; category: string; status: string; moduleCount: number; lessonCount: number; publishedLessonCount: number };

export default function AcademyProgramsPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/academy-admin/courses");
    const json = await res.json();
    if (res.ok) setCourses(json.courses ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createCourse() {
    if (!title.trim()) return;
    setSaving(true);
    await fetch("/api/academy-admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, category }) });
    setSaving(false);
    setTitle(""); setCategory(""); setShowForm(false);
    await load();
  }

  return <SimpleOperationsShell title="Academy Control Center" subtitle="Chương trình đào tạo" homeHref="/academy-admin" routes={academyAdminRoutes} accentLabel="Academy Admin">
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>CHƯƠNG TRÌNH ĐÀO TẠO</span><h1>Khóa học, module &amp; bài học</h1><p>Tạo và chỉnh sửa nội dung khóa học thật — lưu trực tiếp vào cơ sở dữ liệu sản xuất.</p></div>
      <button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => setShowForm((v) => !v)}><Plus size={16} />Tạo khóa học</button>
    </header>

    {showForm && (
      <section className={styles.card} style={{ marginBottom: 18 }}>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Tên khóa học
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 11 }}>Danh mục
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Makeup, Hair, Business…" style={{ padding: 10, borderRadius: 10, border: "1px solid #dfe3e8" }} />
          </label>
          <button className={`${styles.button} ${styles.buttonPrimary}`} disabled={saving} onClick={createCourse}>Lưu</button>
        </div>
      </section>
    )}

    <section className={styles.card}>
      <div className={styles.cardHead}><div><h2>Danh sách khóa học</h2><p>{courses.length} khóa học</p></div></div>
      <div className={styles.cardBody}>
        {loading ? <p>Đang tải…</p> : !courses.length ? (
          <div className={styles.empty}><BookOpenCheck /><strong>Chưa có khóa học nào</strong><p>Tạo khóa học đầu tiên từ form phía trên.</p></div>
        ) : (
          <div className={styles.list}>
            {courses.map((course) => (
              <Link key={course.id} href={`/academy-admin/programs/${course.id}`} className={styles.listItem}>
                <span className={styles.listItemIcon}><BookOpenCheck size={16} /></span>
                <div><strong>{course.title}</strong><small>{course.category || "Chưa phân loại"} · {course.moduleCount} module · {course.lessonCount} bài học</small></div>
                <div className={styles.listItemMeta}>
                  <span className={styles.badge} data-tone={course.status === "active" ? "success" : course.status === "archived" ? "danger" : "warning"}>{course.status}</span>
                  <em>{course.publishedLessonCount}/{course.lessonCount} đã xuất bản</em>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  </SimpleOperationsShell>;
}
