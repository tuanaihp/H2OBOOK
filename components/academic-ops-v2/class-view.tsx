"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Grid3X3, TrendingUp } from "lucide-react";
import { classProgressColumns, classProgressRows } from "@/lib/academic-ops-v2/teaching-data";
import { AcademicOpsFlowBar, IntelligenceHeader } from "./shared";
import styles from "./academic-ops.module.css";

function scoreTone(value: number) {
  if (value >= 80) return "strong";
  if (value >= 60) return "good";
  if (value >= 40) return "warning";
  return "weak";
}

export function AcademicClassViewV2() {
  const [classCode, setClassCode] = useState("MUP-K26");
  return (
    <AppShell>
      <div className={styles.shell}>
        <AcademicOpsFlowBar />
        <IntelligenceHeader
          eyebrow="CLASS INTELLIGENCE VIEW"
          title="Toàn bộ tiến độ lớp trên một màn hình"
          description="Hàng là học viên, cột là bài tập; giảng viên nhìn ngay điểm mạnh, điểm chậm và nhu cầu hỗ trợ."
          actions={
            <select className={styles.selectControl} value={classCode} onChange={(event) => setClassCode(event.target.value)}>
              <option value="MUP-K26">Makeup Chuyên Nghiệp K26</option>
              <option value="SKIN-08">Nền Trong Trẻo Ứng Dụng</option>
              <option value="HAIR-12">Tóc Cô Dâu Nâng Cao</option>
            </select>
          }
        />

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>{classCode === "MUP-K26" ? "Makeup Chuyên Nghiệp K26" : classCode}</h2><p>{classProgressRows.length} học viên · {classProgressColumns.length} bài tập</p></div><Grid3X3/></div>
          <div className={styles.matrixScroll}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>Học viên</th>
                  {classProgressColumns.map((column) => <th key={column.id}>{column.title}<small>{column.dueAt}</small></th>)}
                </tr>
              </thead>
              <tbody>
                {classProgressRows.map((student) => (
                  <tr key={student.id}>
                    <td><strong>{student.name}</strong><small>{student.email}</small></td>
                    {classProgressColumns.map((column) => {
                      const score = student.scores[column.id] ?? 0;
                      return <td key={column.id}><button className={styles.scoreCell} data-tone={scoreTone(score)} type="button"><TrendingUp size={14}/>{score}%</button></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
