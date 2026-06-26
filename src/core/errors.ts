/* Error handling (tenet T5 / Trục 4q):
 * - FluxeError = domain error (giá trị có kiểu) → map status/code/message an toàn.
 * - Lỗi khác = unexpected → 500 generic + errorId; detail chỉ ở dev (không leak prod). */

export class FluxeError extends Error {
  code: string;
  status: number;
  details?: unknown;            // vd: danh sách lỗi field (validation)
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "FluxeError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface ErrorPayload {
  status: number;
  code: string;
  message: string;
  errorId?: string;
  detail?: string;
  details?: unknown;
}

export function toErrorPayload(err: unknown, opts: { dev: boolean; errorId: string }): ErrorPayload {
  if (err instanceof FluxeError) {
    const p: ErrorPayload = { status: err.status, code: err.code, message: err.message };
    if (err.details !== undefined) p.details = err.details;
    return p;
  }
  const e = err as Error;
  const p: ErrorPayload = { status: 500, code: "internal", message: "Internal Server Error", errorId: opts.errorId };
  if (opts.dev) p.detail = e?.stack ?? String(err);
  return p;
}

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderErrorPage(p: ErrorPayload): string {
  const id = p.errorId ? `<p style="color:#888">error id: ${esc(p.errorId)}</p>` : "";
  const detail = p.detail ? `<pre style="background:#1a1a2e;color:#e8e8f0;padding:1rem;overflow:auto;border-radius:6px">${esc(p.detail)}</pre>` : "";
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${p.status} ${esc(p.code)}</title></head>` +
    `<body style="font:14px/1.5 ui-sans-serif,system-ui;margin:3rem;max-width:720px">` +
    `<h1>${p.status} — ${esc(p.code)}</h1><p>${esc(p.message)}</p>${id}${detail}</body></html>`;
}
