"use client";
import dynamic from "next/dynamic";
const EditorWorkspace = dynamic(() => import("@/components/editor/editor-workspace").then(m => m.EditorWorkspace), { ssr: false });
export default function EditorPage(){ return <EditorWorkspace/>; }
