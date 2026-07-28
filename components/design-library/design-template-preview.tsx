import type { CSSProperties } from "react";
import type { DesignTemplateDefinition } from "@/types/design-library";
import styles from "./design-library.module.css";

export function DesignTemplatePreview({ template }: { template: DesignTemplateDefinition }) {
  const vars = {
    "--preview-bg": template.palette.background,
    "--preview-primary": template.palette.primary,
    "--preview-secondary": template.palette.secondary,
    "--preview-accent": template.palette.accent,
    "--preview-text": template.palette.text
  } as CSSProperties;
  return <div className={`${styles.preview} ${styles[template.layout]}`} style={vars}>
    <div className={styles.previewGlow}/>
    <div className={styles.previewPhoto}><span>MAKEUP</span></div>
    <div className={styles.previewCopy}>
      <small>{template.subcategory}</small>
      <strong>{template.name}</strong>
      <span>{template.tags.slice(0, 3).join(" • ")}</span>
    </div>
    <div className={styles.previewAccent}/>
  </div>;
}
