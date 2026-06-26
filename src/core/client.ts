/* ============================================================
 * Client runtime — Inertia-style + mutations DX.
 * - rpc(): gọi action, ném RpcError CÓ CẤU TRÚC (code/message/details) khi lỗi.
 * - mutate(): optimistic + rollback khi lỗi.
 * - revalidate(): refetch props trang hiện tại sau khi mutate.
 * ============================================================ */

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

export async function rpc<T = any>(cell: string, action: string, input: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/__action/${cell}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new RpcError("network", "Mất kết nối máy chủ", 0);
  }
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
export async function fetchPageProps(url: string): Promise<{ cell: string; data: unknown }> {
  const res = await fetch(url, { headers: { "x-fluxe": "1" } });
  return res.json();
}

/* Revalidate: refetch props trang hiện tại (gọi sau mutate để đồng bộ data). */
export async function revalidate(): Promise<{ cell: string; data: unknown }> {
  return fetchPageProps(location.pathname + location.search);
}
