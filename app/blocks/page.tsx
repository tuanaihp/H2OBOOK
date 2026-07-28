"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAppStore } from "@/store/app-store";
import { Blocks, BookOpen, CheckSquare, Megaphone, UserRound, Wrench } from "lucide-react";

const icons = { lesson: BookOpen, practice: Wrench, marketing: Megaphone, profile: UserRound, assessment: CheckSquare };

export default function BlocksPage() {
  const blocks = useAppStore((state) => state.reusableBlocks);
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">REUSABLE CONTENT SYSTEM</span><h1>Block Library</h1><p>Tái sử dụng từng khối nội dung thay vì dựng lại cả trang. Mỗi block tự nhận Brand Kit và chạy không cần AI.</p></div><div className="header-actions"><button className="btn btn-primary"><Blocks size={16}/>Tạo block từ trang</button></div></div>
    <div className="block-library-grid">{blocks.map((block) => { const Icon = icons[block.category]; return <article key={block.id}><div className="block-preview"><span>{block.preview}</span><i/><i/><i/></div><div className="block-info"><span className="block-category"><Icon size={13}/>{block.category}</span><h3>{block.name}</h3><p>{block.description}</p><footer><small>{block.elementCount} thành phần</small><button className="btn btn-soft btn-sm">Dùng block</button></footer></div></article>; })}</div>
  </AppShell>;
}
