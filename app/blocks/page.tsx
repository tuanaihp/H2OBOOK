"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { Blocks, BookOpen, CheckSquare, Layers3, Megaphone, Save, UserRound, Wrench } from "lucide-react";
import type { ReusableBlock } from "@/types/domain";

const icons = { lesson: BookOpen, practice: Wrench, marketing: Megaphone, profile: UserRound, assessment: CheckSquare };

export default function BlocksPage() {
  const store = useAppStore();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceBookId, setSourceBookId] = useState("");
  const [sourcePageId, setSourcePageId] = useState("");
  const [blockName, setBlockName] = useState("");
  const [useBlockId, setUseBlockId] = useState<string | null>(null);
  const [targetBookId, setTargetBookId] = useState("");

  const sourceBook = useMemo(() => store.books.find((item) => item.id === sourceBookId), [store.books, sourceBookId]);
  const usingBlock = store.reusableBlocks.find((item) => item.id === useBlockId);

  const openCreate = () => {
    const first = store.books[0];
    setSourceBookId(first?.id ?? "");
    setSourcePageId(first?.pages[0]?.id ?? "");
    setBlockName("");
    setCreateOpen(true);
  };
  const saveBlock = () => {
    const page = sourceBook?.pages.find((item) => item.id === sourcePageId);
    const block = store.saveBlockFromPage({ bookId: sourceBookId, pageId: sourcePageId, name: blockName.trim() || page?.name });
    if (block) setCreateOpen(false);
  };
  const openUse = (block: ReusableBlock) => {
    setUseBlockId(block.id);
    setTargetBookId(store.books[0]?.id ?? "");
  };
  const applyBlock = () => {
    if (!useBlockId || !targetBookId) return;
    if (store.applyBlockToBook(useBlockId, targetBookId)) {
      setUseBlockId(null);
      router.push(`/editor/${targetBookId}`);
    }
  };

  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">REUSABLE CONTENT SYSTEM</span><h1>Block Library</h1><p>Tái sử dụng từng khối nội dung thay vì dựng lại cả trang. Mỗi block tự nhận Brand Kit và chạy không cần AI.</p></div><div className="header-actions"><button className="btn btn-primary" onClick={openCreate} disabled={!store.books.length}><Blocks size={16}/>Tạo block từ trang</button></div></div>
    <div className="block-library-grid">{store.reusableBlocks.map((block) => { const Icon = icons[block.category]; return <article key={block.id}><div className="block-preview"><span>{block.preview}</span><i/><i/><i/></div><div className="block-info"><span className="block-category"><Icon size={13}/>{block.category}{block.isSystem ? "" : " · tùy chỉnh"}</span><h3>{block.name}</h3><p>{block.description}</p><footer><small>{block.elementCount} thành phần</small><button className="btn btn-soft btn-sm" onClick={() => openUse(block)} disabled={!store.books.length}>Dùng block</button></footer></div></article>; })}</div>

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo block từ trang" description="Chụp layout của một trang thành block tái sử dụng.">
      <div className="form-grid">
        <label className="field"><span>Sách nguồn</span><select className="select" value={sourceBookId} onChange={(event) => { setSourceBookId(event.target.value); setSourcePageId(store.books.find((item) => item.id === event.target.value)?.pages[0]?.id ?? ""); }}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
        <label className="field"><span>Trang</span><select className="select" value={sourcePageId} onChange={(event) => setSourcePageId(event.target.value)}>{(sourceBook?.pages ?? []).map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>
        <label className="field full"><span>Tên block</span><input className="input" value={blockName} onChange={(event) => setBlockName(event.target.value)} placeholder={sourceBook?.pages.find((item) => item.id === sourcePageId)?.name ?? "Tên block"}/></label>
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={saveBlock} disabled={!sourceBookId || !sourcePageId}><Save size={15}/>Lưu block</button></div>
    </Modal>

    <Modal open={Boolean(usingBlock)} onClose={() => setUseBlockId(null)} title={`Dùng block: ${usingBlock?.name ?? ""}`} description="Block được chèn thành một trang mới ở cuối sách và mở ngay trong Studio.">
      <div className="form-grid">
        <label className="field full"><span>Sách đích</span><select className="select" value={targetBookId} onChange={(event) => setTargetBookId(event.target.value)}>{store.books.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.pages.length} trang</option>)}</select></label>
      </div>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setUseBlockId(null)}>Hủy</button><button className="btn btn-primary" onClick={applyBlock} disabled={!targetBookId}><Layers3 size={15}/>Chèn vào sách</button></div>
    </Modal>
  </AppShell>;
}
