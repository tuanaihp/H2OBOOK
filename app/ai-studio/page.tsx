"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { BrainCircuit, Copy, FileText, Languages, ListTree, RefreshCw, ShieldCheck, Sparkles, WandSparkles, WifiOff, Zap } from "lucide-react";
import type { AIAssistType } from "@/types/domain";

const modes: Array<{ id: AIAssistType; label: string; description: string; icon: typeof Sparkles; local: boolean }> = [
  { id: "outline", label: "Tạo đề cương", description: "Phân cấu trúc chương bằng quy tắc local.", icon: ListTree, local: true },
  { id: "rewrite", label: "Cấu trúc lại", description: "Làm rõ và chia ý mà không gọi API.", icon: WandSparkles, local: true },
  { id: "quiz", label: "Tạo câu hỏi", description: "Sinh câu hỏi tự luyện bằng từ khóa local.", icon: FileText, local: true },
  { id: "summary", label: "Tóm tắt local", description: "Chọn câu quan trọng theo từ khóa và vị trí.", icon: BrainCircuit, local: true },
  { id: "brand_copy", label: "Brand Copy", description: "Dùng mẫu thương hiệu và nội dung đầu vào.", icon: Sparkles, local: true },
  { id: "translate", label: "Chuyển ngữ", description: "Nhập thủ công; chỉ tự động khi bật AI tùy chọn.", icon: Languages, local: false },
  { id: "accessibility", label: "Accessibility", description: "Kiểm tra câu dài, đoạn dài và khả năng đọc.", icon: ShieldCheck, local: true }
];

export default function SmartToolsPage() {
  const store = useAppStore();
  const [type, setType] = useState<AIAssistType>("summary");
  const [bookId, setBookId] = useState(store.books[0]?.id ?? "");
  const [prompt, setPrompt] = useState("Nền trong trẻo cần bắt đầu từ việc chuẩn bị da đúng, sử dụng lượng sản phẩm vừa đủ và kiểm soát từng vùng thay vì phủ dày toàn bộ khuôn mặt.");
  const [output, setOutput] = useState(store.aiJobs[0]?.output ?? "");
  const [copied, setCopied] = useState(false);
  const [runningExternal, setRunningExternal] = useState(false);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("book"); if (value && store.books.some((book) => book.id === value)) setBookId(value); }, [store.books]);
  const currentMode = modes.find((mode) => mode.id === type)!;
  const bookJobs = useMemo(() => store.aiJobs.filter((job) => !bookId || job.bookId === bookId).slice(0, 8), [store.aiJobs, bookId]);
  const runLocal = () => { const job = store.runAIAssistant({ type, prompt, bookId: bookId || undefined }); setOutput(job.output); };
  const runOptionalAI = async () => {
    if (!store.smartSettings.aiEnabled) return;
    setRunningExternal(true);
    try {
      const response = await fetch("/api/assist/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, prompt, organizationId: store.workspace.id, context: { bookId }, preferExternal: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "AI_GATEWAY_FAILED");
      setOutput(payload.output ?? payload.result ?? JSON.stringify(payload, null, 2));
    } catch (error) {
      setOutput(`Không thể dùng AI tùy chọn: ${error instanceof Error ? error.message : "Lỗi kết nối"}\n\nBạn vẫn có thể tiếp tục bằng Smart Core Local.`);
    } finally { setRunningExternal(false); }
  };
  const copy = async () => { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return <AppShell>
    <section className="quantum-hero smart-tools-hero"><div><span className="eyebrow">SMART TOOLS — LOCAL BY DEFAULT</span><h1>Công cụ hỗ trợ nội dung không phụ thuộc AI.</h1><p>Đề cương, cấu trúc lại, tóm tắt, câu hỏi và kiểm tra khả năng đọc chạy ngay trên thiết bị. AI chỉ được gọi khi chủ workspace tự bật.</p></div><div className="smart-engine-badge"><WifiOff/><strong>0 token</strong><span>Local engine</span></div></section>
    <div className="smart-tools-layout">
      <aside className="section-card ai-mode-panel"><div className="section-head"><div><h2>Công cụ</h2><p>Local trước, AI sau.</p></div></div><div className="section-body ai-mode-list">{modes.map(({ id, label, description, icon: Icon, local }) => <button key={id} className={type === id ? "active" : ""} onClick={() => setType(id)}><span><Icon size={17}/></span><div><strong>{label}</strong><small>{description}</small></div><i>{local ? "LOCAL" : "OPTION"}</i></button>)}</div></aside>
      <section className="section-card ai-composer"><div className="section-head"><div><h2>{currentMode.label}</h2><p>{currentMode.description}</p></div><select className="compact-select" value={bookId} onChange={(event) => setBookId(event.target.value)}><option value="">Không gắn với sách</option>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></div><div className="section-body"><label className="field"><span>Nội dung đầu vào</span><textarea className="textarea ai-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Dán nội dung cần xử lý..."/></label><div className="smart-run-actions"><button className="btn btn-primary" onClick={runLocal}><Zap size={15}/>Chạy Smart Core Local</button><button className="btn btn-secondary" disabled={!store.smartSettings.aiEnabled || runningExternal} onClick={runOptionalAI}><Sparkles size={15}/>{runningExternal ? "Đang kết nối..." : "Dùng AI tùy chọn"}</button></div><div className="ai-output-head"><strong>Kết quả</strong><div><button className="btn btn-soft btn-sm" onClick={runLocal}><RefreshCw size={13}/>Tạo lại local</button><button className="btn btn-secondary btn-sm" onClick={copy}><Copy size={13}/>{copied ? "Đã sao chép" : "Sao chép"}</button></div></div><pre className="ai-output">{output || "Kết quả local sẽ xuất hiện tại đây."}</pre><div className="ai-disclaimer"><ShieldCheck size={15}/><span>AI mặc định tắt. Bật hoặc tắt AI không ảnh hưởng editor, reader, flashcard, lớp học, xuất bản hay bán sách.</span></div></div></section>
      <aside className="section-card ai-history"><div className="section-head"><div><h2>Lịch sử local</h2><p>Kết quả được lưu trong workspace.</p></div></div><div className="section-body">{bookJobs.map((job) => <button key={job.id} onClick={() => { setType(job.type); setPrompt(job.prompt); setOutput(job.output); }}><strong>{modes.find((item) => item.id === job.type)?.label}</strong><span>{job.prompt.slice(0, 58)}{job.prompt.length > 58 ? "…" : ""}</span><small>{formatDate(job.createdAt)} · {job.provider}</small></button>)}</div></aside>
    </div>
  </AppShell>;
}
