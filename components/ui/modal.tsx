"use client";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({ open, title, description, children, onClose, width = 620 }: { open: boolean; title: string; description?: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal-card" style={{ maxWidth: width }} onMouseDown={(event) => event.stopPropagation()}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-btn" onClick={onClose}><X size={17}/></button></header><div className="modal-body">{children}</div></section></div>;
}
