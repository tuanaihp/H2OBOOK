"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const EditorWorkspace = dynamic(() => import("@/components/editor/editor-workspace").then(m => m.EditorWorkspace), { ssr: false });
const ComposeWorkspace = dynamic(() => import("@/components/editor/compose-workspace").then(m => m.ComposeWorkspace), { ssr: false });

// Input commits produce openPath "/editor/<key>?mode=compose" — that query is not a real
// subroute, so without this the design canvas opened on a semantic-only book and showed
// 0 pages even though the committed document existed in book_documents.
function EditorPageInner() {
  const mode = useSearchParams().get("mode");
  return mode === "compose" ? <ComposeWorkspace/> : <EditorWorkspace/>;
}

export default function EditorPage() {
  return <Suspense fallback={null}><EditorPageInner/></Suspense>;
}
