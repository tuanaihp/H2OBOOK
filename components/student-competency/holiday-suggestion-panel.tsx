"use client";

import { useEffect, useMemo, useState } from "react";
import { getVietnamHolidaySuggestions, type HolidaySuggestion } from "@/lib/teaching/vietnam-holiday-suggestions";
import styles from "./student-management-workspace.module.css";

type Props = {
  existingDates: string[];
  onApply: (items: HolidaySuggestion[]) => Promise<boolean>;
};

export function HolidaySuggestionPanel({ existingDates, onApply }: Props) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const suggestions = useMemo(() => getVietnamHolidaySuggestions(year), [year]);
  const existing = useMemo(() => new Set(existingDates), [existingDates]);
  const available = useMemo(() => suggestions.filter((item) => !existing.has(item.date)), [suggestions, existing]);
  const [selected, setSelected] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => { setSelected(available.map((item) => item.date)); }, [available]);

  const toggle = (date: string) => setSelected((current) => current.includes(date) ? current.filter((value) => value !== date) : [...current, date]);
  const apply = async () => {
    setApplying(true);
    const didApply = await onApply(available.filter((item) => selected.includes(item.date)));
    if (didApply) setSelected([]);
    setApplying(false);
  };

  return <div className={styles.holidaySuggestions}>
    <div className={styles.holidaySuggestionHead}>
      <div><strong>Gợi ý ngày nghỉ năm</strong><p>Chọn năm để hệ thống tự tạo ngày lễ theo từng tháng; bạn duyệt trước khi áp dụng cho toàn Academy.</p></div>
      <label>Năm<input type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} /></label>
    </div>
    <p className={styles.holidayNote}>Tết có 5 ngày gợi ý để duyệt. Các ngày nghỉ bắc cầu được Nhà nước công bố từng năm nên không tự thêm.</p>
    {available.length === 0 ? <p className={styles.message}>Tất cả gợi ý của năm {year} đã được áp dụng.</p> : <><div className={styles.holidaySuggestionList}>{available.map((item) => <label key={item.date} className={styles.holidaySuggestionItem}><input type="checkbox" checked={selected.includes(item.date)} onChange={() => toggle(item.date)} /><span><strong>{item.date}</strong>{item.label}{item.needsConfirmation ? " · cần xác nhận" : ""}</span></label>)}</div><button type="button" className={styles.primaryButton} disabled={applying || selected.length === 0} onClick={() => void apply()}>{applying ? "Đang áp dụng…" : `Áp dụng ${selected.length} ngày đã chọn`}</button></>}
  </div>;
}
