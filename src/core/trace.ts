// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Tracer in-process — dựng CÂY span cho 1 request (waterfall kiểu Jaeger nhưng 0 sidecar/0 dep).
 * Pipeline RCA (auth → parse → validate → resolver → publish) + ctx.span() cho resolver thêm
 * span DB. Serialize sang header x-fluxe-trace → DebugBar vẽ waterfall lồng nhau. KHÔNG distributed
 * (cross-service = việc HOST qua OpenTelemetry); đây là trace 1-process cho DX. */

export interface Span {
  name: string;
  at: number;        // ms kể từ đầu request (offset, để xếp waterfall)
  dur: number;       // ms span chạy
  children: Span[];
}

export interface Tracer {
  span<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
  finish(): Span;     // trả root đã chốt dur
  count(): number;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
const round = (n: number) => Math.round(n * 100) / 100;

/* maxSpans: chặn cây phình (rò RAM/header to). Quá ngưỡng → span mới gộp vào cha, không thêm node. */
export function createTracer(maxSpans = 64): Tracer {
  const t0 = now();
  const root: Span = { name: "request", at: 0, dur: 0, children: [] };
  let current = root;
  let n = 1;

  async function span<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    if (n >= maxSpans) return await fn();              // hết quota → chạy thẳng, không ghi span
    const s: Span = { name, at: round(now() - t0), dur: 0, children: [] };
    current.children.push(s);
    n++;
    const parent = current;
    current = s;
    const st = now();
    try {
      return await fn();
    } finally {
      s.dur = round(now() - st);
      current = parent;
    }
  }

  function finish(): Span {
    root.dur = round(now() - t0);
    return root;
  }

  return { span, finish, count: () => n };
}

/* Encode trace sang header an toàn (JSON → base64). Cắt nếu quá to (header limit). */
export function encodeTrace(root: Span, maxBytes = 8192): string {
  const json = JSON.stringify(root);
  if (Buffer.byteLength(json) > maxBytes) return "";   // bỏ qua trace khổng lồ (không vỡ header)
  return Buffer.from(json).toString("base64");
}

/* Decode header → cây span (client). Hỏng → null. */
export function decodeTrace(header: string | null | undefined): Span | null {
  if (!header) return null;
  try {
    return JSON.parse(typeof atob !== "undefined" ? atob(header) : Buffer.from(header, "base64").toString());
  } catch {
    return null;
  }
}
