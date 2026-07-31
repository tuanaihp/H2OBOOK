"use client";
import { useState } from "react";
import { BrainCircuit, Database, DollarSign, ShieldCheck } from "lucide-react";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Notice, Panel, SystemPageHeader } from "../system-shared";
import styles from "../system-governance-ops-v2.module.css";

const tasks = ["outline", "rewrite", "quiz", "summary", "brand_copy", "translate", "accessibility"];
export function AssistControlV2() {
  const [enabled, setEnabled] = useState(false);
  const [allowed, setAllowed] = useState(tasks.slice(0, 5));
  return <>
    <SystemPageHeader eyebrow="OPTIONAL AI CONTROL" title="AI là trợ lý, không phải nền móng." description="Khi ngân sách bằng 0 hoặc Gateway mất kết nối, toàn bộ core tiếp tục chạy bằng Smart Core Local." actions={<span className={styles.heroPill}><ShieldCheck/>Core độc lập AI</span>}/>
    <Notice title="Fail-open về Local Core" tone="info">Mọi request AI lỗi đều trả kết quả local thay vì chặn người dùng.</Notice>
    <div className={styles.threeColumn}><Panel title="Trạng thái" description="AI mặc định tắt theo workspace." icon={<BrainCircuit/>}><div className={styles.switchRow}><span><strong>Cho phép AI ngoài</strong><small>Chỉ bật sau khi workspace xác nhận.</small></span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)}/></div><label className={styles.field}>Chế độ mặc định<select defaultValue="local"><option value="local">Smart Core Local</option><option value="hybrid">Hybrid Assist</option></select></label><div className={styles.switchRow}><span><strong>Cache kết quả</strong><small>Giảm token cho tác vụ lặp lại.</small></span><input type="checkbox" defaultChecked/></div></Panel><Panel title="Ngân sách" description="Hard limit theo tháng." icon={<DollarSign/>}><label className={styles.field}>Ngân sách tháng (USD)<input type="number" defaultValue={0}/></label><label className={styles.field}>Ký tự tối đa mỗi request<input type="number" defaultValue={60000}/></label><div className={styles.budgetBar}><span style={{ width: "0%" }}/></div><small className={styles.muted}>Đã dùng $0.00 / $0.00</small></Panel><Panel title="Tác vụ được phép" description="Tắt riêng từng nhóm công việc." icon={<ShieldCheck/>}><div className={styles.chips}>{tasks.map((task) => <button key={task} className={allowed.includes(task) ? styles.chipActive : ""} onClick={() => setAllowed((current) => current.includes(task) ? current.filter((item) => item !== task) : [...current, task])}>{task}</button>)}</div><div className={styles.switchRow}><span><strong>Cho gửi ảnh</strong><small>Mặc định không gửi asset ra ngoài.</small></span><input type="checkbox"/></div><div className={styles.switchRow}><span><strong>Nguồn bên ngoài</strong><small>Mặc định chỉ dùng nội dung người dùng chọn.</small></span><input type="checkbox"/></div></Panel></div>
    <div className={styles.saveBar}><span>{enabled ? "AI được bật theo policy hiện tại" : "AI đang tắt mặc định"}</span><button className={styles.primaryButton} onClick={() => emitSystemEvent("system_policy_saved", { surface: "assist-control", enabled, allowed })}><Database/>Lưu AI Policy</button></div>
  </>;
}
