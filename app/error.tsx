"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

// A chunk-load failure is not an application error, it is a stale tab: a deploy replaced the
// JavaScript bundles this page was built against, so a lazily-loaded chunk it asks for is gone.
//
// reset() cannot fix that. It re-renders the same tree, which requests the same chunk, which
// webpack has already cached as a rejected promise — so the retry button fails identically every
// time and the page is stuck for good. Only a full document load fetches the new bundle.
const CHUNK_ERROR = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;
// One automatic reload per tab. Without the guard, a genuinely missing asset would reload forever.
const RELOAD_GUARD = "h2obook:chunk-reload";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunkError = CHUNK_ERROR.test(`${error.name} ${error.message}`);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!isChunkError) return;
    if (sessionStorage.getItem(RELOAD_GUARD)) return;
    sessionStorage.setItem(RELOAD_GUARD, "1");
    setReloading(true);
    window.location.reload();
  }, [isChunkError]);

  // Surviving the reload means the assets really are unreachable, not merely stale, so the guard is
  // cleared for the next visit and the user gets a button instead of another silent reload.
  useEffect(() => {
    if (!isChunkError) sessionStorage.removeItem(RELOAD_GUARD);
  }, [isChunkError]);

  return <main className="fatal-page">
    <AlertTriangle />
    <h1>{isChunkError ? "H2OBOOK vừa được cập nhật" : "H2OBOOK gặp lỗi khi tải màn hình"}</h1>
    <p>{isChunkError
      ? (reloading ? "Đang tải lại phiên bản mới…" : "Tab này đang chạy phiên bản cũ. Bấm nút bên dưới để tải lại phiên bản mới nhất.")
      : (error.message || "Lỗi không xác định")}</p>
    <button className="btn btn-primary" onClick={() => {
      if (!isChunkError) { reset(); return; }
      sessionStorage.removeItem(RELOAD_GUARD);
      window.location.reload();
    }}><RefreshCw />{isChunkError ? "Tải lại" : "Thử lại"}</button>
  </main>;
}
