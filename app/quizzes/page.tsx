"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { uid } from "@/lib/utils";
import { BarChart3, CheckCircle2, Clock3, FileQuestion, Pencil, Plus, Send, Sparkles } from "lucide-react";

export default function QuizzesPage() {
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [passing, setPassing] = useState(70);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const editing = store.quizzes.find((item) => item.id === editId);
  const create = () => { const quiz = store.createQuiz({ title: title.trim() || "Bài kiểm tra mới", bookId, passingScore: passing, status: "draft" }); setOpen(false); setTitle(""); setEditId(quiz.id); };
  const addQuestion = () => {
    if (!editing || !question.trim()) return;
    const correct = answer.trim() || "Đúng";
    store.updateQuiz(editing.id, { questions: [...editing.questions, { id: uid("question"), type: "single", question: question.trim(), options: [correct, "Phương án khác", "Chưa đủ dữ liệu"], correctAnswers: [correct], explanation: "Giảng viên có thể bổ sung giải thích chi tiết.", score: 10 }] });
    setQuestion(""); setAnswer("");
  };
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">KNOWLEDGE ASSESSMENT</span><h1>Quiz & kiểm tra</h1><p>Tạo câu hỏi theo chương, chấm tự động và theo dõi năng lực học viên.</p></div><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/>Tạo quiz</button></div>
    <div className="quiz-grid">{store.quizzes.map((quiz) => { const book = store.books.find((item) => item.id === quiz.bookId); return <article className="quiz-card" key={quiz.id}><div className="quiz-card-head"><span className="quiz-icon"><FileQuestion size={21}/></span><Badge tone={quiz.status === "published" ? "success" : "warning"}>{quiz.status === "published" ? "Đang sử dụng" : "Bản nháp"}</Badge><button className="icon-btn" title="Mở trình biên soạn" onClick={() => setEditId(quiz.id)}><Pencil size={15}/></button></div><h3>{quiz.title}</h3><p>{book?.title} • {quiz.chapterName}</p><div className="quiz-stat-row"><span><FileQuestion size={15}/><strong>{quiz.questions.length}</strong> câu</span><span><Clock3 size={15}/><strong>{quiz.timeLimitMinutes}</strong> phút</span><span><CheckCircle2 size={15}/><strong>{quiz.passingScore}%</strong> đạt</span></div><div className="quiz-score"><div><BarChart3 size={17}/><span>Điểm trung bình</span></div><strong>{quiz.averageScore || 0}%</strong></div><div className="progress"><span style={{ width: `${quiz.averageScore}%` }}/></div><footer><span>{quiz.attemptCount} lượt làm</span><button className="btn btn-secondary btn-sm" onClick={() => setEditId(quiz.id)}>Chỉnh sửa câu hỏi</button></footer></article>; })}</div>
    <Modal open={open} onClose={() => setOpen(false)} title="Tạo bài kiểm tra" description="Sau khi tạo, trình biên soạn câu hỏi sẽ mở ngay."><div className="form-grid"><label className="field full"><span>Tên bài kiểm tra</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kiểm tra kỹ thuật nền"/></label><label className="field"><span>Sách liên quan</span><select className="select" value={bookId} onChange={(event) => setBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label><label className="field"><span>Điểm đạt (%)</span><input className="input" type="number" min="0" max="100" value={passing} onChange={(event) => setPassing(Number(event.target.value))}/></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Send size={15}/>Tạo quiz</button></div></Modal>
    <Modal open={Boolean(editing)} onClose={() => setEditId(null)} title={editing?.title ?? "Biên soạn quiz"} description={`${editing?.questions.length ?? 0} câu hỏi • Điểm đạt ${editing?.passingScore ?? 0}%`} width={760}><div className="quiz-editor-list">{editing?.questions.length ? editing.questions.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><strong>{item.question}</strong><small>Đáp án: {item.correctAnswers.join(", ")} • {item.score} điểm</small></div></article>) : <p className="muted">Chưa có câu hỏi. Thêm câu hỏi đầu tiên bên dưới.</p>}</div><div className="quiz-add-question"><label className="field"><span>Câu hỏi</span><input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ví dụ: Bước đầu tiên trước khi đánh nền là gì?"/></label><label className="field"><span>Đáp án đúng</span><input className="input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Phân tích loại da"/></label><button className="btn btn-secondary" onClick={addQuestion}><Plus size={15}/>Thêm câu hỏi</button></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setEditId(null)}>Đóng</button><button className="btn btn-primary" onClick={() => editing && store.updateQuiz(editing.id, { status: "published" })}><Sparkles size={15}/>Xuất bản quiz</button></div></Modal>
  </AppShell>;
}
