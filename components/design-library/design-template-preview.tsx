"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { resolveAssetUrl } from "@/lib/assets/asset-client";
import type { H2OElement } from "@/types/editor";
import type { DesignTemplateDefinition } from "@/types/design-library";
import styles from "./design-library.module.css";

const PREVIEW_WIDTH = 380;

function SnapshotImage({ element, base, pageWidth }: { element: H2OElement; base: CSSProperties; pageWidth: number }) {
  const durableUrl = element.imageUrl && !element.imageUrl.startsWith("blob:") ? element.imageUrl : null;
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (durableUrl || !element.assetId) return;
    void resolveAssetUrl(element.assetId).then((url) => { objectUrl = url; if (!cancelled) setResolved(url); });
    return () => { cancelled = true; if (objectUrl?.startsWith("blob:")) URL.revokeObjectURL(objectUrl); };
  }, [element.assetId, durableUrl]);
  const url = durableUrl ?? resolved;
  return <div style={{ ...base, backgroundImage: url ? `url(${url})` : undefined, backgroundColor: url ? undefined : "#e8dfe3", backgroundSize: element.imageFit === "contain" ? "contain" : "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", borderRadius: element.cornerRadius ? element.cornerRadius * (PREVIEW_WIDTH / pageWidth) : undefined }}/>;
}

function SnapshotElement({ element, pageWidth, pageHeight }: { element: H2OElement; pageWidth: number; pageHeight: number }) {
  const base: CSSProperties = {
    left: `${(element.x / pageWidth) * 100}%`,
    top: `${(element.y / pageHeight) * 100}%`,
    width: `${(element.width / pageWidth) * 100}%`,
    height: `${(element.height / pageHeight) * 100}%`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.opacity
  };
  switch (element.type) {
    case "text":
      return <div style={{
        ...base,
        color: element.fill,
        fontSize: Math.max(5, (element.fontSize ?? 24) * (PREVIEW_WIDTH / pageWidth)),
        fontFamily: element.fontFamily,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle,
        textDecoration: element.textDecoration,
        textAlign: element.align,
        lineHeight: element.lineHeight,
        letterSpacing: element.letterSpacing ? element.letterSpacing * (PREVIEW_WIDTH / pageWidth) : undefined,
        WebkitTextStroke: element.strokeWidth ? `${element.strokeWidth * (PREVIEW_WIDTH / pageWidth)}px ${element.stroke}` : undefined,
        overflow: "hidden",
        whiteSpace: "pre-wrap"
      }}>{element.text}</div>;
    case "image":
      return <SnapshotImage element={element} base={base} pageWidth={pageWidth}/>;
    case "shape":
      return <div style={{ ...base, background: element.fill, border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.stroke}` : undefined, borderRadius: element.cornerRadius ? element.cornerRadius * (PREVIEW_WIDTH / pageWidth) : undefined }}/>;
    case "line":
      return <div style={{ ...base, borderTop: `${Math.max(1, (element.strokeWidth ?? 2) * (PREVIEW_WIDTH / pageWidth))}px solid ${element.stroke ?? "#000"}` }}/>;
    default:
      return <div style={{ ...base, background: "rgba(120,120,140,.25)" }}/>;
  }
}

export function DesignTemplatePreview({ template }: { template: DesignTemplateDefinition }) {
  const snapshot = template.snapshot?.[0];
  if (snapshot) {
    return <div className={`${styles.preview} ${styles.snapshotPreview}`} style={{ background: snapshot.background ?? "#ffffff", aspectRatio: `${snapshot.width}/${snapshot.height}` }}>
      {snapshot.elements.map((element) => <SnapshotElement key={element.id} element={element} pageWidth={snapshot.width} pageHeight={snapshot.height}/>)}
    </div>;
  }
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
