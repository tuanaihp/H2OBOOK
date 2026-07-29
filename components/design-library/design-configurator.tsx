"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CopyPlus, FileSpreadsheet, Palette, Sparkles, X } from "lucide-react";
import type { BrandProfile } from "@/types/editor";
import type { DesignFormatKey, DesignTemplateDefinition } from "@/types/design-library";
import { DESIGN_FORMATS } from "@/lib/design-library/formats";
import { createDefaultFieldValues } from "@/lib/design-library/smart-fields";
import { parseDesignCsv } from "@/lib/design-library/bulk";
import { DesignTemplatePreview } from "./design-template-preview";
import styles from "./design-library.module.css";

export type DesignCreatePayload = {
  values: Record<string, string>;
  targetFormat: DesignFormatKey;
  brand: BrandProfile;
  useBrandKit: boolean;
  bulkRows?: Record<string, string>[];
};

export function DesignConfigurator({
  template,
  brands,
  activeBrandId,
  onClose,
  onCreate,
  allowBulk = true
}: {
  template: DesignTemplateDefinition;
  brands: BrandProfile[];
  activeBrandId: string;
  onClose: () => void;
  onCreate: (payload: DesignCreatePayload) => void;
  allowBulk?: boolean;
}) {
  const initialBrand = brands.find((item) => item.id === activeBrandId) ?? brands[0];
  const [brandId, setBrandId] = useState(initialBrand?.id ?? "");
  const brand = useMemo(() => brands.find((item) => item.id === brandId) ?? initialBrand, [brands, brandId, initialBrand]);
  const [values, setValues] = useState<Record<string, string>>(() => brand ? createDefaultFieldValues(template.fields, brand) : {});
  const [targetFormat, setTargetFormat] = useState<DesignFormatKey>(template.baseFormat);
  const [useBrandKit, setUseBrandKit] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [csv, setCsv] = useState("studentName,certificateNo,issueDate\nNguyễn Minh Anh,H2O-001,28.07.2026\nTrần Thu Hà,H2O-002,28.07.2026");

  useEffect(() => {
    if (brand) setValues(createDefaultFieldValues(template.fields, brand));
  }, [brand, template]);

  if (!brand) return null;
  const rows = bulkMode ? parseDesignCsv(csv) : [];
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Cấu hình ${template.name}`}>
      <header className={styles.modalHeader}>
        <div><span>MAKEUP DESIGN WIZARD</span><h2>{template.name}</h2><p>{template.description}</p></div>
        <button className={styles.iconButton} onClick={onClose} aria-label="Đóng"><X size={20}/></button>
      </header>
      <div className={styles.modalBody}>
        <aside className={styles.configPreview}>
          <DesignTemplatePreview template={template}/>
          <div className={styles.previewNotes}>
            <div><CheckCircle2 size={16}/><span>Brand Kit và layer khóa sẵn</span></div>
            <div><CheckCircle2 size={16}/><span>Smart Fields thay nội dung nhanh</span></div>
            <div><CheckCircle2 size={16}/><span>Mở trực tiếp trong H2OBOOK Editor</span></div>
          </div>
        </aside>
        <div className={styles.configForm}>
          <div className={styles.formGrid}>
            <label><span>Brand Profile</span><select value={brandId} onChange={(event) => setBrandId(event.target.value)}>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Kích thước đầu ra</span><select value={targetFormat} onChange={(event) => setTargetFormat(event.target.value as DesignFormatKey)}>{template.supportedFormats.map((key) => <option key={key} value={key}>{DESIGN_FORMATS[key].label}</option>)}</select></label>
          </div>
          <label className={styles.switchRow}><input type="checkbox" checked={useBrandKit} onChange={(event) => setUseBrandKit(event.target.checked)}/><span><Palette size={17}/>Áp dụng màu và font từ Brand Kit</span></label>
          <div className={styles.fieldsList}>{template.fields.map((item) => <label key={item.key}><span>{item.label}{item.required ? " *" : ""}</span>{item.type === "textarea" ? <textarea value={values[item.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))} placeholder={item.placeholder}/> : <input type={item.type === "date" ? "text" : item.type} value={values[item.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))} placeholder={item.placeholder}/>}</label>)}</div>
          {allowBulk && template.bulkCapable && <div className={styles.bulkBox}>
            <button className={styles.bulkToggle} onClick={() => setBulkMode((current) => !current)}><FileSpreadsheet size={17}/>{bulkMode ? "Tắt tạo hàng loạt" : "Tạo hàng loạt bằng CSV"}</button>
            {bulkMode && <><p>Dòng đầu là tên Smart Field. Mỗi dòng tiếp theo tạo một thiết kế riêng.</p><textarea value={csv} onChange={(event) => setCsv(event.target.value)}/><strong>{rows.length} thiết kế sẽ được tạo</strong></>}
          </div>}
        </div>
      </div>
      <footer className={styles.modalFooter}>
        <button className={styles.secondaryButton} onClick={onClose}>Hủy</button>
        <button className={styles.primaryButton} onClick={() => onCreate({ values, targetFormat, brand, useBrandKit, bulkRows: bulkMode ? rows : undefined })} disabled={bulkMode && rows.length === 0}>
          {bulkMode ? <CopyPlus size={18}/> : <Sparkles size={18}/>}{bulkMode ? `Tạo ${rows.length} thiết kế` : "Tạo thiết kế và mở Editor"}
        </button>
      </footer>
    </section>
  </div>;
}
