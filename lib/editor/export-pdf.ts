import { exportProfiles, renderFixedLayoutHtml } from "@h2obook/publishing-core";
import type { H2OBook } from "@/types/editor";

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Exports every page of a book through the shared fixed-layout renderer with the
 * `pdf-web` export profile. Opens a print-ready document so the browser can save
 * a real PDF; when popups are blocked it falls back to downloading the HTML file.
 * Returns "print" | "download" so callers can surface what actually happened.
 */
export function exportBookPdf(book: H2OBook): "print" | "download" {
  const profile = exportProfiles.find((item) => item.id === "pdf-web") ?? exportProfiles[0];
  const html = renderFixedLayoutHtml(book, profile);
  const target = window.open("", "_blank");
  if (target) {
    target.document.open();
    target.document.write(html);
    target.document.close();
    setTimeout(() => target.print(), 500);
    return "print";
  }
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(book.title)}.html`;
  anchor.click();
  URL.revokeObjectURL(url);
  return "download";
}
