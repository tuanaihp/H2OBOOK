"use client";
import { useState } from "react";
import { CloudDownload, CloudUpload, GitCompareArrows, History } from "lucide-react";
import { cloudSnapshots } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Notice, Panel, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

export function CloudSyncV2() {
  const [message, setMessage] = useState("Chưa đồng bộ trong phiên này.");
  const run = (action: "push" | "pull") => { setMessage(action === "push" ? "Đã tạo yêu cầu snapshot mới." : "Đã tạo yêu cầu lấy snapshot mới nhất."); emitSystemEvent("system_sync_requested", { action }); };
  return <>
    <SystemPageHeader eyebrow="CLOUD DATA BRIDGE" title="Đồng bộ và khôi phục" description="Đẩy dữ liệu local-first lên cloud, xem diff và chỉ khôi phục sau khi xác minh version." actions={<span className={styles.heroPill}><History/>Snapshot v3.5</span>}/>
    <div className={styles.twoColumn}><article className={styles.actionHero}><CloudUpload/><h2>Đẩy dữ liệu lên cloud</h2><p>Tạo snapshot bất biến gồm sách, template, clone, học viên, đơn hàng, automation và cấu hình.</p><button className={styles.primaryButton} onClick={() => run("push")}>Đồng bộ ngay</button></article><article className={styles.actionHero}><CloudDownload/><h2>Khôi phục từ cloud</h2><p>Lấy snapshot mới nhất, kiểm tra version và preview thay đổi trước khi nhập.</p><button className={styles.secondaryButton} onClick={() => run("pull")}>Lấy bản mới nhất</button></article></div>
    <Notice title="Trạng thái" tone="info">{message}</Notice>
    <div className={styles.twoColumn}><Panel title="Snapshot gần đây" description="Danh sách phải được trả về từ server adapter."><div className={styles.tableWrap}><table><thead><tr><th>Phiên bản</th><th>Thời điểm</th><th>Dung lượng</th><th>Trạng thái</th></tr></thead><tbody>{cloudSnapshots.map((snapshot) => <tr key={snapshot.id}><td><strong>{snapshot.version}</strong></td><td>{snapshot.createdAt}</td><td>{snapshot.size}</td><td>{snapshot.status}</td></tr>)}</tbody></table></div></Panel><Panel title="Diff & Recovery" description="Không ghi đè dữ liệu trước khi người dùng xác nhận."><div className={styles.diffList}><div><GitCompareArrows/><span><strong>12 bản ghi mới</strong><small>Sách, học viên và đơn hàng.</small></span></div><div><GitCompareArrows/><span><strong>3 xung đột</strong><small>Brand Kit và settings cần review.</small></span></div><div><GitCompareArrows/><span><strong>0 bản ghi xóa</strong><small>Không có thao tác phá hủy trong preview.</small></span></div></div><div className={styles.panelActions}><button className={styles.softButton}>Xem diff đầy đủ</button><button className={styles.secondaryButton}>Mở recovery plan</button></div></Panel></div>
  </>;
}
