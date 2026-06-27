// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Chaos injection (DEV) — parse header "delay=600;fail=0.3" để inject độ trễ + lỗi
 * vào backend call. Test UX loading/error/rollback KHÔNG cần sửa code. Thuần, testable. */
export interface Chaos { delayMs: number; failRate: number }

export function parseChaos(header: string | undefined): Chaos {
  const out: Chaos = { delayMs: 0, failRate: 0 };
  for (const part of (header ?? "").split(";")) {
    const [k, v] = part.split("=");
    if (k?.trim() === "delay") out.delayMs = Math.max(0, Number(v) || 0);
    if (k?.trim() === "fail") out.failRate = Math.min(1, Math.max(0, Number(v) || 0));
  }
  return out;
}
