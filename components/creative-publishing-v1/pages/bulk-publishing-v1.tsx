"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Layers3, Play, Upload, UsersRound } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { mergeSmartFields, parseCreativeCsv } from "@/lib/creative-publishing-v1/bulk";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, EmptyPanel, StatusPill, SurfaceCard, styles } from "../creative-shared";
import type { BulkCsvRow } from "@/lib/creative-publishing-v1/types";

const sampleCsv = "title,studentName,certificateNo,issueDate\nBằng tốt nghiệp,Nguyễn Minh Anh,H2O-001,30/07/2026\nBằng tốt nghiệp,Trần Thu Hà,H2O-002,30/07/2026";

export function BulkPublishingV1() {
  const store = useAppStore();
  const [templateId, setTemplateId] = useState(store.templates[0]?.id ?? "");
  const [csvText, setCsvText] = useState(sampleCsv);
  const [rows, setRows] = useState<BulkCsvRow[]>(() => parseCreativeCsv(sampleCsv));
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const template = store.templates.find((item) => item.id === templateId);
  const sourceBook = store.books.find((book) => book.id === template?.sourceBookId);
  const detectedFields = useMemo(() => {
    const text = sourceBook?.pages.flatMap((page) => page.elements.map((element) => element.text ?? "")).join(" ") ?? "";
    return Array.from(new Set(Array.from(text.matchAll(/{{\s*([^}]+?)\s*}}/g)).map((match) => match[1])));
  }, [sourceBook]);

  const parse = (value: string) => {
    setCsvText(value);
    setRows(parseCreativeCsv(value));
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    parse(await file.text());
  };

  const generate = () => {
    if (!template || !sourceBook || rows.length === 0) return;
    emitCreativeEvent({ name: "creative_job_started", surface: "bulk-publishing", action: "generate_batch", entityId: template.id, metadata: { rows: rows.length } });
    const ids = rows.slice(0, 500).map((row, index) => {
      const book = store.createBook({
        title: row.title || `${sourceBook.title} — ${index + 1}`,
        subtitle: mergeSmartFields(sourceBook.subtitle || "{{studentName}}", row),
        author: row.studentName || sourceBook.author,
        brandId: sourceBook.brandId,
        category: sourceBook.category,
        tags: [...sourceBook.tags, "bulk-generated"],
      });
      return book.id;
    });
    setCreatedIds(ids);
    emitCreativeEvent({ name: "creative_job_completed", surface: "bulk-publishing", action: "generate_batch", entityId: template.id, metadata: { created: ids.length } });
  };

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "h2obook-bulk-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <CreativePageFrame active="bulk-publishing" eyebrow="DATA AUTOMATION" title="Bulk Publishing Studio" description="Tạo hàng loạt tài liệu từ template và dữ liệu CSV mà không bắt buộc AI." actions={<button className={styles.secondaryButton} onClick={downloadSample}><Download/>Tải CSV mẫu</button>} metrics={[
    { label: "Template", value: store.templates.length },
    { label: "Dòng hợp lệ", value: rows.length },
    { label: "Smart Fields", value: detectedFields.length },
    { label: "Đã tạo", value: createdIds.length },
  ]}>
    <div className={styles.twoColumn}>
      <SurfaceCard title="1. Master Template" description="Chọn template chứa Smart Fields." icon={<Layers3/>}>
        <select className={styles.selectWide} value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{store.templates.map((item) => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select>
        <div className={styles.inlineBadges}>{detectedFields.length ? detectedFields.map((field) => <StatusPill key={field} tone="info">{`{{${field}}}`}</StatusPill>) : <StatusPill tone="warning">Template chưa có Smart Fields trong text layer</StatusPill>}</div>
      </SurfaceCard>
      <SurfaceCard title="2. Nguồn dữ liệu" description="CSV local hoặc adapter Google Sheets công khai." icon={<FileSpreadsheet/>}>
        <label className={styles.uploadDrop}><Upload/><strong>Chọn file CSV</strong><input hidden type="file" accept=".csv,text/csv" onChange={(event) => void importFile(event)}/></label>
        <textarea className={styles.codeArea} value={csvText} onChange={(event) => parse(event.target.value)} spellCheck={false}/>
      </SurfaceCard>
    </div>
    <SurfaceCard title="3. Kiểm tra và tạo" description="Chỉ dòng hợp lệ mới được sinh tài liệu." icon={<UsersRound/>}>
      {rows.length ? <div className={styles.tableWrap}><table><thead><tr>{Object.keys(rows[0]).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.slice(0, 6).map((row, index) => <tr key={`${index}-${row.title ?? "row"}`}>{Object.keys(rows[0]).map((header) => <td key={header}>{row[header]}</td>)}</tr>)}</tbody></table></div> : <EmptyPanel title="Chưa có dữ liệu hợp lệ" description="Tải CSV hoặc nhập dữ liệu vào vùng nguồn."/>}
      <button className={styles.widePrimaryButton} disabled={!template || rows.length === 0} onClick={generate}><Play/>Tạo {rows.length} tài liệu</button>
      {createdIds.length ? <div className={styles.successPanel}><strong>Đã tạo {createdIds.length} dự án sách.</strong><p>Các dự án mới đã xuất hiện trong Dự án sách và sẵn sàng mở trong Editor.</p></div> : null}
    </SurfaceCard>
  </CreativePageFrame>;
}
