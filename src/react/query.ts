// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { useState, useEffect, useRef } from "react";
import { debug } from "./store";
import { lastRpcMeta } from "../core/client";

/* useQuery — react-query-lite: cache theo key, dedup in-flight (chống refetch storm),
 * loading/error/data, refetch, log tracing (resolution/timing). */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { initial?: T; enabled?: boolean } = {},
) {
  const [data, setData] = useState<T | undefined>(
    opts.initial !== undefined ? opts.initial : (cache.get(key) as T | undefined),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  async function run() {
    // Dedup: nếu đã có fetch đang bay cho key → dùng chung, không bắn request mới.
    let p = inflight.get(key) as Promise<T> | undefined;
    const fresh = !p;
    if (!p) {
      const id = debug.start("query", "query:" + key);
      p = (async () => {
        try {
          const d = await fetcherRef.current();
          const m = lastRpcMeta();
          cache.set(key, d);
          debug.finish(id, { status: "ok", data: d, resolution: m.resolution, serverMs: m.serverMs, ms: m.clientMs });
          return d;
        } catch (e: any) {
          const m = lastRpcMeta();
          debug.finish(id, { status: "error", error: e?.message ?? String(e), resolution: m.resolution });
          throw e;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, p);
    }
    if (fresh) { setLoading(true); setError(""); }
    try {
      setData(await p);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (opts.enabled === false) return;
    if (opts.initial !== undefined && cache.get(key) === undefined) cache.set(key, opts.initial);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, error, loading, refetch: run };
}
