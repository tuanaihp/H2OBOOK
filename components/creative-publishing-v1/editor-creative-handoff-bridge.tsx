"use client";

import { useEffect } from "react";
import { clearCreativeHandoff, readCreativeHandoff } from "@/lib/creative-publishing-v1/editor-handoff";

export function EditorCreativeHandoffBridge({ consume = false }: { consume?: boolean }) {
  useEffect(() => {
    const handoff = readCreativeHandoff();
    if (!handoff) return;
    window.dispatchEvent(new CustomEvent("h2obook:creative-handoff", { detail: handoff }));
    if (consume) clearCreativeHandoff();
  }, [consume]);
  return null;
}
