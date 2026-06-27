// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";

/* Render cache — ETag/304: hash body, client gửi If-None-Match → 304 nếu không đổi
 * (không gửi lại body). Dùng cho JSON props (SPA nav refetch nhiều). */
export function etagOf(body: string): string {
  return `"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
}

export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").map((s) => s.trim()).includes(etag);
}
