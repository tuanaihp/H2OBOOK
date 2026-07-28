import { Suspense } from "react";
import { UnifiedInputGateway } from "@/components/input/unified-input-gateway";

export default async function InputPage({ searchParams }: { searchParams: Promise<{ bookId?: string }> }) {
  const params = await searchParams;
  return <main className="input-page-shell"><Suspense fallback={<div className="page-loading">Đang mở Input Gateway…</div>}><UnifiedInputGateway initialBookId={params.bookId}/></Suspense></main>;
}
