"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MailPlus, MoreHorizontal, Plus, Search, UserCheck } from "lucide-react";
import { studentAccessRows } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader, MetricGrid } from "./shared";
import styles from "./academic-ops.module.css";

export function AcademicStudentsV2() {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => studentAccessRows.filter((student) => [student.name, student.email, student.phone].join(" ").toLowerCase().includes(query.toLowerCase())), [query]);
  const average = Math.round(studentAccessRows.reduce((sum, student) => sum + student.progress, 0) / studentAccessRows.length);

  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader eyebrow="STUDENT ACCESS" title="Học viên" description="Cấp tài khoản, thư viện, membership và theo dõi tiến độ học." actions={<><button className="btn btn-secondary" type="button"><MailPlus size={16}/>Mời hàng loạt</button><button className="btn btn-primary" type="button"><Plus size={16}/>Thêm học viên</button></>}/>
        <MetricGrid items={[
          { label: "Tổng học viên", value: String(studentAccessRows.length), note: "Trong workspace" },
          { label: "Đang học", value: String(studentAccessRows.filter((student) => student.status === "learning").length), note: "Có hoạt động" },
          { label: "Hồ sơ chờ duyệt", value: "0", note: "Từ Academy" },
          { label: "Tiến độ trung bình", value: `${average}%`, note: "Theo sách và bài tập" }
        ]}/>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Hồ sơ đăng ký từ Academy</h2><p>Lead công khai chạy trực tiếp vào đây; duyệt sẽ tạo user và entitlement.</p></div><span className={styles.status}>0 chờ duyệt</span></div>
          <div className={styles.emptyState}>Chưa có hồ sơ đăng ký công khai.</div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div className={styles.search}><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm học viên theo tên, email, điện thoại..."/></div><span>{visible.length} học viên</span></div>
          <div className={styles.matrixScroll}>
            <table className={styles.studentTable}><thead><tr><th>Học viên</th><th>Lớp học</th><th>Tiến độ</th><th>Sách hoàn thành</th><th>Hoạt động cuối</th><th>Trạng thái</th><th/></tr></thead><tbody>{visible.map((student) => <tr key={student.id}><td><div className={styles.studentIdentity}><span className={styles.avatar}>{student.id.toUpperCase()}</span><span><strong>{student.name}</strong><small>{student.email}<br/>{student.phone}</small></span></div></td><td>{student.classCode}</td><td><div className={styles.progress}><i style={{ width: `${student.progress}%` }}/></div><small>{student.progress}%</small></td><td>{student.booksCompleted}</td><td>{student.lastActive}</td><td><span className={styles.status}>{student.status === "learning" ? "Đang học" : student.status === "invited" ? "Đã mời" : "Tạm dừng"}</span></td><td><button className={styles.iconButton} type="button"><MoreHorizontal size={16}/></button></td></tr>)}</tbody></table>
          </div>
        </section>
        <section className={styles.grid3}><article className={styles.entityCard}><UserCheck/><h3>Provisioning có kiểm soát</h3><p>Chỉ cấp quyền sau khi xác nhận đăng ký, thanh toán và lớp phù hợp.</p></article><article className={styles.entityCard}><MailPlus/><h3>Mời hàng loạt</h3><p>CSV và email invitation có trạng thái, retry và log lỗi.</p></article><article className={styles.entityCard}><Search/><h3>Tìm kiếm thống nhất</h3><p>Tên, email, điện thoại, mã lớp và membership dùng cùng một bộ lọc.</p></article></section>
      </div>
    </AppShell>
  );
}
