"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, Circle, CirclePlay, Clock3, FileText, ListVideo, Play, RotateCcw } from "lucide-react";
import type { StudentCourseData, StudentLesson } from "@/lib/academy/student-course";

function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} phút`;
}

function VideoSurface({ lesson, onPosition }: { lesson: StudentLesson; onPosition: (seconds: number) => void }) {
  const customerCode = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (lesson.videoProvider === "cloudflare_stream" && lesson.videoPlaybackId) {
    const origin = customerCode ? `https://customer-${customerCode}.cloudflarestream.com` : "https://iframe.videodelivery.net";
    return <iframe key={lesson.id} src={`${origin}/${encodeURIComponent(lesson.videoPlaybackId)}/iframe?autoplay=false&preload=metadata`} title={lesson.title} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen/>;
  }
  if (lesson.videoProvider === "direct" && lesson.videoUrl) return <video key={lesson.id} controls preload="metadata" src={lesson.videoUrl} onTimeUpdate={(event) => onPosition(Math.floor(event.currentTarget.currentTime))}/>;
  if (lesson.videoProvider === "embed" && lesson.videoUrl?.startsWith("https://")) return <iframe key={lesson.id} src={lesson.videoUrl} title={lesson.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>;
  return <div className="h2o-player-placeholder"><span><Play/></span><small>LESSON CONTENT</small><h2>{lesson.title}</h2><p>{lesson.description}</p><em>Bài học này chưa có video. Bạn vẫn có thể đọc nội dung, làm checklist và nộp bài tập bên dưới; video sẽ xuất hiện ngay khi giảng viên tải lên.</em></div>;
}

export function CoursePlayer({ initialCourse }: { initialCourse: StudentCourseData }) {
  const storageKey = `h2obook-course-progress:${initialCourse.slug}`;
  const [course, setCourse] = useState(initialCourse);
  const flatLessons = useMemo(() => course.modules.flatMap((module) => module.lessons), [course.modules]);
  const firstIncomplete = flatLessons.find((lesson) => !lesson.completed) ?? flatLessons[0];
  const [activeId, setActiveId] = useState(firstIncomplete?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const positionRef = useRef(0);
  const activeIndex = flatLessons.findIndex((lesson) => lesson.id === activeId);
  const active = flatLessons[activeIndex] ?? flatLessons[0];
  const completed = flatLessons.filter((lesson) => lesson.completed).length;
  const percent = flatLessons.length ? Math.round(completed * 100 / flatLessons.length) : 0;

  useEffect(() => {
    if (course.mode !== "demo") return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>;
      setCourse((current) => ({ ...current, modules: current.modules.map((module) => ({ ...module, lessons: module.lessons.map((lesson) => ({ ...lesson, completed: Boolean(saved[lesson.id]) })) })) }));
    } catch { /* Invalid local demo state is ignored. */ }
  }, [course.mode, storageKey]);

  async function toggleComplete() {
    if (!active || busy) return;
    setBusy(true); setNotice("");
    const nextCompleted = !active.completed;
    try {
      const response = await fetch(`/api/student/lessons/${encodeURIComponent(active.id)}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted, watchSeconds: Math.max(active.watchSeconds, positionRef.current), lastPositionSeconds: positionRef.current })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "PROGRESS_SAVE_FAILED");
      const nextCourse = { ...course, modules: course.modules.map((module) => ({ ...module, lessons: module.lessons.map((lesson) => lesson.id === active.id ? { ...lesson, completed: nextCompleted, watchSeconds: Math.max(lesson.watchSeconds, positionRef.current), lastPositionSeconds: positionRef.current } : lesson) })) };
      setCourse(nextCourse);
      if (course.mode === "demo") localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(nextCourse.modules.flatMap((module) => module.lessons).map((lesson) => [lesson.id, lesson.completed]))));
      setNotice(nextCompleted ? "Đã hoàn thành bài học và cập nhật Skill Map." : "Đã mở lại bài học.");
      if (nextCompleted && activeIndex < flatLessons.length - 1) setTimeout(() => setActiveId(flatLessons[activeIndex + 1].id), 500);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu tiến độ."); }
    finally { setBusy(false); }
  }

  if (!active) return <div className="h2o-player-empty">Khóa học chưa có bài học được xuất bản.</div>;
  return <div className="h2o-course-player-shell">
    <section className="h2o-player-main">
      <div className="h2o-player-video"><VideoSurface lesson={active} onPosition={(seconds) => { positionRef.current = seconds; }}/></div>
      <div className="h2o-player-lesson-head"><div><span>BÀI {activeIndex + 1}/{flatLessons.length} · {durationLabel(active.durationSeconds)}</span><h1>{active.title}</h1><p>{active.description}</p></div><div style={{ display: "flex", gap: 8 }}>{active.knowledgeSpaceSlug && <Link href={`/student/spaces/${active.knowledgeSpaceSlug}`} className="btn btn-soft" style={{ textDecoration: "none" }}><Brain size={16}/>Học ngay</Link>}<button className={active.completed ? "completed" : ""} disabled={busy} onClick={toggleComplete}>{active.completed ? <RotateCcw/> : <CheckCircle2/>}{active.completed ? "Đánh dấu chưa xong" : "Hoàn thành bài học"}</button></div></div>
      {notice && <div className="h2o-player-notice">{notice}</div>}
      <div className="h2o-player-content"><article><FileText/><div><span>TÓM TẮT</span><p>{active.content.summary ?? active.description}</p></div></article><article><ListVideo/><div><span>CHECKLIST THỰC HÀNH</span><ul>{(active.content.checklist ?? []).map((item) => <li key={item}>{item}</li>)}</ul></div></article></div>
      <div className="h2o-player-navigation"><button disabled={activeIndex <= 0} onClick={() => setActiveId(flatLessons[activeIndex - 1].id)}><ArrowLeft/>Bài trước</button><button disabled={activeIndex >= flatLessons.length - 1} onClick={() => setActiveId(flatLessons[activeIndex + 1].id)}>Bài tiếp theo<ArrowRight/></button></div>
    </section>
    <aside className="h2o-player-playlist"><header><div><span>TIẾN ĐỘ KHÓA HỌC</span><strong>{percent}%</strong></div><em><i style={{ width: `${percent}%` }}/></em><small>{completed}/{flatLessons.length} bài hoàn thành</small></header><div className="h2o-player-modules">{course.modules.map((module, moduleIndex) => <section key={module.id}><h3><span>{String(moduleIndex + 1).padStart(2, "0")}</span>{module.title}</h3>{module.lessons.map((lesson) => <button key={lesson.id} className={`${lesson.id === active.id ? "active" : ""} ${lesson.completed ? "done" : ""}`} onClick={() => { setActiveId(lesson.id); positionRef.current = lesson.lastPositionSeconds; }}><span>{lesson.completed ? <CheckCircle2/> : lesson.id === active.id ? <CirclePlay/> : <Circle/>}</span><div><strong>{lesson.title}</strong><small><Clock3/>{durationLabel(lesson.durationSeconds)}</small></div></button>)}</section>)}</div></aside>
  </div>;
}
