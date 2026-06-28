// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* ============================================================
 * Client runtime — Inertia-style + mutations DX.
 * - rpc(): gọi action, ném RpcError CÓ CẤU TRÚC (code/message/details) khi lỗi.
 * - mutate(): optimistic + rollback khi lỗi.
 * - revalidate(): refetch props trang hiện tại sau khi mutate.
 * ============================================================ */
import { decodeTrace } from "./trace.ts";

export class RpcError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Pure: dựng RpcError từ status + body trả về (server trả {error:{code,message,details}}).
export function parseRpcError(status: number, body: string): RpcError {
  try {
    const e = JSON.parse(body)?.error;
    if (e?.code) return new RpcError(e.code, e.message ?? "Lỗi", status, e.details);
  } catch {
    /* không phải JSON */
  }
  return new RpcError("http", `HTTP ${status}`, status);
}

function cookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

/* DevTools config (chỉ ảnh hưởng dev): chaos injection. DebugBar set. */
let _chaos = "";        // vd "delay=600;fail=0.3"
export const setChaos = (v: string) => { _chaos = v; };
export const getChaos = () => _chaos;

/* Meta của rpc gần nhất (resolution + timing server + span trace) — hook đọc ngay sau await để log. */
export interface RpcMeta { resolution?: string; serverMs?: number; clientMs?: number; trace?: import("./trace.ts").Span | null }
let _lastMeta: RpcMeta = {};
export const lastRpcMeta = (): RpcMeta => _lastMeta;

export async function rpc<T = any>(cell: string, action: string, input: unknown): Promise<T> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const headers: Record<string, string> = { "content-type": "application/json", "x-csrf-token": cookie("csrf") };
  if (_chaos) headers["x-fluxe-chaos"] = _chaos;            // #1 chaos
  let res: Response;
  try {
    res = await fetch(`/__action/${cell}/${action}`, { method: "POST", headers, body: JSON.stringify(input) });
  } catch {
    _lastMeta = {};
    throw new RpcError("network", "Mất kết nối máy chủ", 0);
  }
  const hget = (k: string) => res.headers?.get?.(k) ?? null;
  _lastMeta = {                                             // #3 resolution + #4 server timing
    resolution: hget("x-fluxe-resolution") ?? undefined,
    serverMs: Number(hget("x-fluxe-server-ms")) || undefined,
    clientMs: Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0),
  };
  if (!res.ok) throw parseRpcError(res.status, await res.text());
  return res.json();
}

/* Contract op qua POST /__rpc/<op> (tRPC-style). Dùng bởi client api sinh từ contract.
 * query: đọc thuần · mutation: server kiểm CSRF (double-submit, header dưới). */
export async function rpcCall<O = any>(op: string, input?: unknown): Promise<O> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const headers: Record<string, string> = { "content-type": "application/json", "x-csrf-token": cookie("csrf") };
  if (_chaos) headers["x-fluxe-chaos"] = _chaos;
  let res: Response;
  try {
    res = await fetch(`/__rpc/${op}`, { method: "POST", headers, body: JSON.stringify(input ?? {}) });
  } catch {
    _lastMeta = {};
    throw new RpcError("network", "Mất kết nối máy chủ", 0);
  }
  const hget = (k: string) => res.headers?.get?.(k) ?? null;
  _lastMeta = {                                             // resolution + server timing + span trace (waterfall)
    resolution: hget("x-fluxe-resolution") ?? undefined,
    serverMs: Number(hget("x-fluxe-server-ms")) || undefined,
    clientMs: Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0),
    trace: decodeTrace(hget("x-fluxe-trace")),
  };
  if (!res.ok) throw parseRpcError(res.status, await res.text());
  return res.json();
}

/* Client contract (tRPC-style) — Proxy typed bằng infer, 0 codegen, 0 schema xuống browser.
 *   const api = createClient<typeof contract>();  await api.todos();  api.addTodo({ title });
 * Truy cập property = op name → POST /__rpc/<op>. Kiểu suy từ contract (type-only import). */
export function createClient<C extends import("./contract.ts").Contract>(): import("./contract.ts").Client<C> {
  return new Proxy({}, { get: (_t, op: string) => (input?: unknown) => rpcCall(op, input) }) as import("./contract.ts").Client<C>;
}

/* Upload file qua POST /__upload/<field> (multipart). Trả { key, url, size } (hoặc mảng nếu nhiều). */
export async function upload(field: string, files: File | File[]): Promise<{ key: string; url: string; size: number } | Array<{ key: string; url: string; size: number }>> {
  const fd = new FormData();
  for (const f of Array.isArray(files) ? files : [files]) fd.append(field, f);
  const res = await fetch(`/__upload/${field}`, {
    method: "POST",
    headers: { "x-csrf-token": cookie("csrf") },   // KHÔNG set content-type — browser tự thêm boundary
    body: fd,
  });
  if (!res.ok) throw parseRpcError(res.status, await res.text());
  return res.json();
}

// Optimistic update: chạy optimistic() ngay, run() ngầm; lỗi → rollback() + ném lại.
export async function mutate<T>(opts: {
  optimistic?: () => void;
  run: () => Promise<T>;
  rollback?: () => void;
}): Promise<T> {
  opts.optimistic?.();
  try {
    return await opts.run();
  } catch (e) {
    opts.rollback?.();
    throw e;
  }
}

/* SPA navigation kiểu Inertia: lấy props JSON rồi để runtime render lại */
export async function fetchPageProps(url: string): Promise<{ cell: string; data: unknown; layout?: string }> {
  const res = await fetch(url, { headers: { "x-fluxe": "1" } });
  if (!res.ok) throw new Error(`fetchPageProps ${url} → ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new Error("không phải trang cell");   // file tĩnh → hard nav
  return res.json();
}

/* Revalidate: refetch props trang hiện tại (gọi sau mutate để đồng bộ data). */
export async function revalidate(): Promise<{ cell: string; data: unknown }> {
  return fetchPageProps(location.pathname + location.search);
}

/* Số kết nối SSE đang mở (devtools live-state). */
let _sseLive = 0;
export const sseLive = (): number => _sseLive;

/* Realtime: subscribe topic qua SSE. Trả hàm hủy. (Trục 4g) */
export function subscribe(topic: string, onData: (data: any) => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const es = new EventSource(`/__sse/${encodeURIComponent(topic)}`);
  _sseLive++;
  es.onmessage = (e) => {
    try { onData(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  let closed = false;
  return () => { if (!closed) { closed = true; _sseLive--; es.close(); } };
}
