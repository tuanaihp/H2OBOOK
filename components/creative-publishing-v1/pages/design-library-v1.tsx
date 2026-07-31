"use client";

import Link from "next/link";
import { Award, BookImage, Copy, GraduationCap, Image, LayoutTemplate, Megaphone, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

const groups = [
  { title: "Cover Fanpage", count: 4, icon: BookImage, detail: "Layout Makeup và thông báo khóa học" },
  { title: "Profile Makeup", count: 4, icon: Image, detail: "Thương hiệu cá nhân Makeup Artist" },
  { title: "Thiệp mời học viên", count: 4, icon: GraduationCap, detail: "Khóa chuyên nghiệp, nâng cao và cá nhân" },
  { title: "Bằng tốt nghiệp", count: 4, icon: Award, detail: "QR xác minh và bulk CSV" },
  { title: "Khuyến mãi", count: 4, icon: Megaphone, detail: "Cô dâu, tiệc, flash sale và combo" },
];

export function DesignLibraryV1() {
  const books = useAppStore((state) => state.books);
  const designBooks = books.filter((book) => book.tags.includes("design-library") || book.category.toLowerCase().includes("design"));
  return <CreativePageFrame active="design-library" eyebrow="MAKEUP DESIGN OPERATING SYSTEM" title="Thư viện thiết kế Makeup" description="Module này không tạo Editor mới; mọi mẫu đều sinh H2OBook rồi handoff sang Studio." actions={<Link className={styles.primaryButton} href="/design-library"><Sparkles/>Mở thư viện đầy đủ</Link>} metrics={[
    { label: "Nhóm thiết kế", value: groups.length },
    { label: "Mẫu chuyên biệt", value: 20 },
    { label: "Thiết kế đã tạo", value: designBooks.length },
    { label: "Brand Kit", value: "1-click" },
  ]}>
    <SurfaceCard title="Template Registry" description="Một registry dùng chung cho preview, configurator và buildDesignBook()." icon={<LayoutTemplate/>} tone="gradient">
      <div className={styles.categoryGrid}>{groups.map(({ title, count, icon: Icon, detail }) => <article key={title}><Icon/><div><strong>{title}</strong><span>{detail}</span></div><StatusPill tone="info">{count} mẫu</StatusPill></article>)}</div>
    </SurfaceCard>
    <div className={styles.twoColumn}>
      <SurfaceCard title="Luồng Dùng mẫu" description="Route thật, không phụ thuộc modal state."><div className={styles.flowSteps}>{["Chọn mẫu", "Điền Smart Fields", "Áp dụng Brand Kit", "Tạo H2OBook", "Mở Editor", "Xuất PNG/PDF"].map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong></div>)}</div></SurfaceCard>
      <SurfaceCard title="Bulk & Certificate" description="Tạo thiệp và bằng hàng loạt từ CSV."><div className={styles.callout}><Copy/><div><strong>CSV → Smart Fields → H2OBook</strong><p>Mỗi dòng có ID riêng, mã bằng và URL xác minh.</p></div></div><Link className={styles.secondaryButton} href="/creative-publishing-v1-preview/bulk-publishing">Mở Bulk Publishing</Link></SurfaceCard>
    </div>
  </CreativePageFrame>;
}
