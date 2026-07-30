"use client";

import Link from "next/link";
import { AlertTriangle, BookOpenCheck, CalendarDays, GraduationCap, UsersRound } from "lucide-react";
import { useOperationsStore } from "@/store/operations-store";
import { OperationsMetric } from "./metric-card";
import { StatusBadge } from "./status-badge";
import styles from "./operations.module.css";

export function InstructorDashboard() {
  const store = useOperationsStore();
  const pending = store.assessmentTasks.filter((item) => item.status !== "graded").length;
  return <>
    <header className={styles.header}><div><span className={styles.eyebrow}>INSTRUCTOR COMMAND CENTER</span><h1>Giảng dạy, đánh giá và hỗ trợ đúng lúc</h1><p>Một không gian riêng cho giảng viên theo dõi lớp, bài cần chấm và học viên đang cần can thiệp.</p></div><div className={styles.headerActions}><Link href="/instructor/assessments" className={`${styles.button} ${styles.buttonPrimary}`}>Chấm bài ngay</Link></div></header>
    <section className={styles.metrics}><OperationsMetric icon={GraduationCap} value={store.instructorClasses.filter((item)=>item.status==="active").length} label="Lớp đang giảng"/><OperationsMetric icon={BookOpenCheck} value={pending} label="Bài cần chấm"/><OperationsMetric icon={UsersRound} value={store.instructorClasses.reduce((sum,item)=>sum+item.studentCount,0)} label="Học viên phụ trách"/><OperationsMetric icon={AlertTriangle} value={store.instructorClasses.reduce((sum,item)=>sum+item.atRiskStudents,0)} label="Học viên cần hỗ trợ"/></section>
    <div className={styles.grid}><section className={`${styles.card} ${styles.span7}`}><div className={styles.cardHead}><div><h2>Lớp của tôi</h2><p>Tiến độ và buổi học tiếp theo.</p></div><Link href="/instructor/classes">Xem tất cả</Link></div><div className={styles.cardBody}><div className={styles.list}>{store.instructorClasses.map((course) => <div className={styles.listItem} key={course.id}><span className={styles.listItemIcon}><CalendarDays size={16}/></span><div><strong>{course.name}</strong><small>{course.code} · {course.schedule}</small><div className={styles.progress}><i style={{width:`${course.progress}%`}}/></div></div><div className={styles.listItemMeta}><StatusBadge value={course.status}/><em>{course.studentCount} học viên</em></div></div>)}</div></div></section><section className={`${styles.card} ${styles.span5}`}><div className={styles.cardHead}><div><h2>Bài cần phản hồi</h2><p>Ưu tiên theo deadline và mức độ.</p></div></div><div className={styles.cardBody}><div className={styles.list}>{store.assessmentTasks.map((task) => <div className={styles.listItem} key={task.id}><span className={styles.listItemIcon}><BookOpenCheck size={16}/></span><div><strong>{task.studentName}</strong><small>{task.assignmentTitle}</small></div><div className={styles.listItemMeta}><StatusBadge value={task.status}/><em>{task.priority}</em></div></div>)}</div></div></section></div>
  </>;
}
