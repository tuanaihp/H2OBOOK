"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { BadgeCheck, Copy, Send, ShieldCheck } from "lucide-react";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import { BusinessPageHeader, BusinessPipelineBar, Panel } from "../business-ops-shared";
import styles from "../business-ops-v1.module.css";

export function MarketplaceStudioV1() {
  const [description, setDescription] = useState("Bộ giáo trình nhiều chương, khóa layout và tự điền toàn bộ thương hiệu.");
  const [price, setPrice] = useState(1290000);
  const [submitted, setSubmitted] = useState(false);
  const score = useMemo(() => Math.min(100, 45 + (description.length > 60 ? 20 : 8) + (price > 0 ? 15 : 0) + 15), [description, price]);
  const submit = () => { setSubmitted(true); emitBusinessEvent({ name: "business_listing_submitted", surface: "marketplace-studio", action: "submit_listing", entityId: "template-makeup-master", metadata: { score } }); };
  return <div className={styles.surface}><BusinessPageHeader eyebrow="KNOWLEDGE MARKETPLACE" title="Marketplace Studio" description="Đóng gói, định giá, kiểm tra chất lượng và áp dụng chính sách cấp phép mặc định." actions={<button className={styles.primaryButton} onClick={submit}><Send/>Gửi listing</button>}/><BusinessPipelineBar active="marketplace-studio"/><Panel title="Sản phẩm nguồn" description="Template hoặc sách đã tồn tại trong workspace." icon={<Copy/>}><label className={styles.field}>Template<select><option>Giáo trình Makeup Master</option><option>Workbook thực hành</option></select></label><label className={styles.field}>Mô tả<textarea value={description} onChange={(event) => setDescription(event.target.value)}/></label><label className={styles.field}>Giá bán (VND)<input type="number" value={price} onChange={(event) => setPrice(Number(event.target.value))}/></label>{submitted ? <div className={styles.successNotice}><BadgeCheck/>Listing đã vào hàng đợi kiểm duyệt.</div> : null}</Panel><div className={styles.twoColumn}><Panel title="Quality Score" description="Điểm kiểm soát trước khi xuất hiện trên marketplace." icon={<BadgeCheck/>}><div className={styles.scoreCircle} style={{ "--score": `${score}%` } as CSSProperties}><strong>{score}</strong><small>/100</small></div><ul className={styles.checkList}><li className={styles.checkDone}>Ảnh bìa</li><li className={description.length > 60 ? styles.checkDone : ""}>Mô tả đầy đủ</li><li className={styles.checkDone}>Metadata</li><li>Preflight & accessibility</li><li>Review người mua</li></ul></Panel><Panel title="License mặc định" description="Áp dụng khi listing được mua." icon={<ShieldCheck/>}><dl className={styles.definitionList}><div><dt>Loại</dt><dd>Linked Clone</dd></div><div><dt>Số clone</dt><dd>10</dd></div><div><dt>Học viên</dt><dd>500</dd></div><div><dt>White-label</dt><dd>Được phép</dd></div><div><dt>Royalty</dt><dd>70% tác giả</dd></div></dl></Panel></div></div>;
}
