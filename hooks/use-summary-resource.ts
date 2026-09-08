"use client";

import { useCallback, useEffect, useState } from "react";

export class SummaryRequestError extends Error {
  constructor(public status: number) { super("SUMMARY_REQUEST_FAILED"); }
}

/** Component-owned request lifecycle: no global cache of private student/tenant data. */
export function useSummaryResource<T>(url: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: number | null }>({ data: null, loading: true, error: null });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    setState((previous) => ({ ...previous, loading: true, error: null }));
    void (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new SummaryRequestError(response.status);
        const data = await response.json() as T;
        if (data === null) throw new SummaryRequestError(502);
        if (active) setState({ data, loading: false, error: null });
      } catch (error) {
        if (active) setState({ data: null, loading: false, error: error instanceof SummaryRequestError ? error.status : 0 });
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [url, revision]);
  return { ...state, refresh };
}
