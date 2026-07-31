"use client";

import Link from "next/link";
import { AlertTriangle, BookCopy, CheckCircle2, GitBranch, Pencil, RefreshCw, ShieldCheck, Undo2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";

export function CloneCenterV1() {
  const store = useAppStore();
  const synced = store.clones.filter((item) => item.status === "synced").length;
  const updates = store.clones.filter((item) => item.status === "update_available").length;
  const conflicts = store.clones.filter((item) => item.status === "conflict").length;

  return <CreativePageFrame active="clones" eyebrow="BRAND CLONE ENGINE" title="Trung tâm nhân bản sách" description="Linked clone giữ kết nối với master; independent clone hoạt động độc lập." actions={<Link className={styles.primaryButton} href="/creative-publishing-v1-preview/templates"><BookCopy/>Tạo bản clone mới</Link>} metrics={[
    { label: "Tổng bản clone", value: store.clones.length },
    { label: "Đã đồng bộ", value: synced },
    { label: "Có cập nhật", value: updates },
    { label: "Xung đột", value: conflicts },
  ]}>
    <SurfaceCard title="Linked Clone Registry" description="Mỗi bản ghi giữ template, target book, brand, override và source version.">
      <div className={styles.tableWrap}><table><thead><tr><th>Đối tác / sách</th><th>Chế độ</th><th>Phiên bản</th><th>Ghi đè</th><th>Trạng thái</th><th>Đồng bộ gần nhất</th><th/></tr></thead><tbody>{store.clones.map((clone) => {
        const brand = store.brands.find((item) => item.id === clone.brandId);
        const book = store.books.find((item) => item.id === clone.targetBookId);
        return <tr key={clone.id}><td><div className={styles.tableIdentity}><span style={{ background: brand?.primaryColor ?? "#6f1446" }}>{(brand?.name ?? clone.partnerName).slice(0, 2)}</span><div><strong>{clone.partnerName}</strong><small>{book?.title ?? clone.targetBookId}</small></div></div></td><td><StatusPill tone={clone.mode === "linked" ? "info" : "neutral"}>{clone.mode === "linked" ? <><GitBranch/>Linked</> : "Independent"}</StatusPill></td><td>v{clone.sourceVersion} → v{clone.currentTemplateVersion}</td><td><strong>{clone.overrideCount}</strong> lớp<br/><small>{clone.conflictCount} xung đột</small></td><td><StatusPill tone={clone.status === "synced" ? "success" : clone.status === "conflict" ? "danger" : "warning"}>{clone.status === "synced" ? <><CheckCircle2/>Đồng bộ</> : clone.status === "conflict" ? <><AlertTriangle/>Xung đột</> : "Có cập nhật"}</StatusPill></td><td>{new Date(clone.lastSyncedAt).toLocaleDateString("vi-VN")}</td><td><div className={styles.rowActions}><Link href={`/editor/${clone.targetBookId}`} title="Mở"><Pencil/></Link>{clone.status === "conflict" ? <button title="Giải quyết xung đột" onClick={() => store.resolveCloneConflicts(clone.id)}><ShieldCheck/></button> : <button title="Đồng bộ" onClick={() => store.syncClone(clone.id)}><RefreshCw/></button>}</div></td></tr>;
      })}</tbody></table></div>
    </SurfaceCard>
    <div className={styles.threeColumn}><SurfaceCard title="Cơ chế Linked Clone" icon={<GitBranch/>}><p>Element chưa tùy biến nhận patch tự động. Element đã override được đưa vào hàng chờ đối chiếu.</p></SurfaceCard><SurfaceCard title="Bảo vệ nội dung" icon={<ShieldCheck/>}><p>Layer bắt buộc, bản quyền và trang chính sách có thể khóa theo template version.</p></SurfaceCard><SurfaceCard title="Rollback phiên bản" icon={<Undo2/>}><p>Giữ snapshot trước đồng bộ để có thể phục hồi khi phát hiện sai lệch.</p></SurfaceCard></div>
  </CreativePageFrame>;
}
