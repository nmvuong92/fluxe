import { useState, useEffect, useRef } from "react";
import { debug } from "./store";

/* useQuery — react-query-lite: cache theo key, loading/error/data, refetch, log tracing.
 * DX: const q = useQuery("todos", () => rpc("todos","list",{}), { initial: data.todos }) */
const cache = new Map<string, unknown>();

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
    setLoading(true);
    setError("");
    const id = debug.start("query", "query:" + key);
    try {
      const d = await fetcherRef.current();
      cache.set(key, d);
      setData(d);
      debug.finish(id, { status: "ok", data: d });
    } catch (e: any) {
      setError(e?.message ?? String(e));
      debug.finish(id, { status: "error", error: e?.message ?? String(e) });
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
