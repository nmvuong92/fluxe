import { useState } from "react";
import { debug } from "./store";

/* useMutation — gọi action server, log tracing + lỗi có cấu trúc.
 * DX: const add = useMutation("todos.add", (t:string) => rpc("todos","add",{title:t})) */
export function useMutation<I, O>(label: string, fn: (input: I) => Promise<O>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function mutate(input: I): Promise<O | undefined> {
    setLoading(true);
    setError("");
    const id = debug.start("mutation", "rpc:" + label);
    try {
      const out = await fn(input);
      debug.finish(id, { status: "ok", data: out });
      return out;
    } catch (e: any) {
      const msg = e?.details?.[0]?.message ?? e?.message ?? String(e);
      setError(msg);
      debug.finish(id, { status: "error", error: msg });
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { mutate, loading, error };
}
