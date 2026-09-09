"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, BookOpen, CheckCircle2, FileText, HelpCircle, Sparkles } from "lucide-react";
import type { StudentLesson } from "@/lib/academy/student-course";
import { getLocalMentorAnswer } from "@/lib/student/experience";

type AssistantMode = "explain" | "source" | "review";

export function ContextualLearningAssistant({ lesson }: { lesson: StudentLesson }) {
  const [mode, setMode] = useState<AssistantMode>("explain");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const summary = lesson.content.summary ?? lesson.description;
  const modes = useMemo(() => ({
    explain: {
      label: "Giải thích đoạn này",
      title: "Giải thích theo bài đang mở",
      content: summary,
      icon: HelpCircle,
    },
    source: {
      label: "Xem nguồn",
      title: "Nguồn và nội dung liên quan",
      content: lesson.knowledgeSpaceSlug
        ? "Mở không gian kiến thức của bài để đọc nội dung gốc, ghi chú và các phần liên quan."
        : "Bài học này chưa gắn không gian kiến thức. Bạn vẫn có thể xem tóm tắt và checklist ở đây.",
      icon: BookOpen,
    },
    review: {
      label: "Tạo câu hỏi ôn tập",
      title: "Tự kiểm tra trước khi thực hành",
      content: `Hãy tự trả lời: (1) bước nào trong “${lesson.title}” cần chuẩn bị trước? (2) dấu hiệu nào cho thấy thao tác cần điều chỉnh? (3) bạn sẽ kiểm tra kết quả bằng bằng chứng nào?`,
      icon: FileText,
    },
  }), [lesson.knowledgeSpaceSlug, lesson.title, summary]);
  const current = modes[mode];
  const Icon = current.icon;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    setAnswer(getLocalMentorAnswer(`${lesson.title}. ${value}`));
    setQuestion("");
  }

  return <section className="h2o-learning-assistant" aria-label="Trợ lý theo ngữ cảnh bài học">
    <header><span><Sparkles/>H2O HỖ TRỢ HỌC TẬP</span><small>Local-first · AI tùy chọn</small></header>
    <div className="h2o-learning-assistant-context"><b>ĐANG HỌC</b><strong>{lesson.title}</strong><p>Hỗ trợ dựa trên nội dung đang mở. Không tự chấm điểm, nộp bài hay thay đổi tiến độ.</p></div>
    <div className="h2o-learning-assistant-actions" role="group" aria-label="Cách hỗ trợ">
      {(Object.keys(modes) as AssistantMode[]).map((key) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setAnswer(""); }}>{modes[key].label}</button>)}
    </div>
    <div className="h2o-learning-assistant-answer" aria-live="polite"><Icon/><div><span>{current.title}</span><p>{answer || current.content}</p>{mode === "source" && lesson.knowledgeSpaceSlug && <Link href={`/student/spaces/${lesson.knowledgeSpaceSlug}`}><BookOpen/>Mở nội dung gốc</Link>}</div></div>
    <form onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Hỏi thêm về bài đang học…" aria-label="Hỏi về bài đang học"/><button type="submit" aria-label="Gửi câu hỏi"><ArrowUp/></button></form>
    <footer><CheckCircle2/>Bạn luôn có thể tiếp tục đọc, làm checklist và nộp bài khi trợ lý không khả dụng.</footer>
  </section>;
}
