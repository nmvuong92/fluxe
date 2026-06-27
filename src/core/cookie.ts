// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Cookie parse thuần — engine cần để đọc cookie locale/theme (Resolved Shell, i18n).
 * Auth/session là việc của HOST framework (fluxe = cầu nối RCA, không tự làm auth). */
export function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
