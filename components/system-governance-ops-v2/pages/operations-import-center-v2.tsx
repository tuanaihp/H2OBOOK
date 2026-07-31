"use client";

import { useState } from "react";
import { FileSpreadsheet, History, RotateCcw, UploadCloud } from "lucide-react";
import { importBatches as initialBatches } from "@/lib/system-governance-ops-v2/data";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { Panel, SystemPageHeader } from "../system-shared";
import { OperationsStatus, OperationsTable, ProgressBar } from "../operations-shared";
import styles from "../system-governance-ops-v2.module.css";

export function OperationsImportCenterV2() {
  const [batches, setBatches] = useState(initialBatches);
  const commit = (id: string) => { setBatches((items) => items.map((item) => item.id === id ? { ...item, status: "completed" } : item)); emitSystemEvent("operations_import_committed", { batchId: id }); };
  const rollback = (id: string) => { setBatches((items) => items.map((item) => item.id === id ? { ...item, status: "rolled_back" } : item)); emitSystemEvent("operations_import_rolled_back", { batchId: id }); };
  return <>
    <SystemPageHeader eyebrow="H2OBOOK OPERATIONS" title="Data Import Center" description="Import, mapping, preview, validate, commit và rollback dữ liệu cũ." actions={<button className={styles.primaryButton}><UploadCloud/> Tải dữ liệu</button>}/>
    <Panel title="Các lô dữ liệu" description="Commit Production bắt buộc idempotency key, transaction và audit." icon={<FileSpreadsheet/>}><OperationsTable><thead><tr><th>File</th><th>Loại</th><th>Dòng</th><th>Hợp lệ</th><th>Lỗi</th><th>Tiến độ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.fileName}</strong><small>{batch.owner}</small></td><td>{batch.entity}</td><td>{batch.rows}</td><td>{batch.validRows}</td><td>{batch.errorRows}</td><td><ProgressBar value={Math.round((batch.validRows / batch.rows) * 100)} tone={batch.errorRows ? "warning" : "success"}/></td><td><OperationsStatus status={batch.status === "completed" ? "completed" : batch.status === "failed" ? "failed" : batch.status === "rolled_back" ? "paused" : "pending"} label={batch.status}/></td><td>{batch.status === "completed" ? <button className={styles.secondaryButton} onClick={() => rollback(batch.id)}><RotateCcw/> Rollback</button> : <button className={styles.primaryButton} onClick={() => commit(batch.id)}><History/> Commit</button>}</td></tr>)}</tbody></OperationsTable></Panel>
  </>;
}
