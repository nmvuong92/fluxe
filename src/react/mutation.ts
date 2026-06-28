// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { debug } from "./store";
import { lastRpcMeta } from "../core/client";

/* useMutation — gọi action server, log tracing (resolution/timing) + lỗi có cấu trúc. */
export function useMutation<I, O>(label: string, fn: (input: I) => Promise<O>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function mutate(input: I): Promise<O | undefined> {
    setLoading(true);
    setError("");
    const id = debug.start("mutation", "rpc:" + label);
    try {
      const out = await fn(input);
      const m = lastRpcMeta();
      debug.finish(id, { status: "ok", data: out, input, resolution: m.resolution, serverMs: m.serverMs, ms: m.clientMs, trace: m.trace });
      return out;
    } catch (e: any) {
      const m = lastRpcMeta();
      const msg = e?.details?.[0]?.message ?? e?.message ?? String(e);
      setError(msg);
      debug.finish(id, { status: "error", error: msg, input, resolution: m.resolution, serverMs: m.serverMs });
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { mutate, loading, error };
}
