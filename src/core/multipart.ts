// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Parser multipart/form-data — THUẦN, chỉ Buffer (không lib). Tách body theo boundary thành
 * các part { name, filename?, contentType?, data }. Dùng cho upload. */

export interface Part {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

const CRLFCRLF = Buffer.from("\r\n\r\n");

/* boundary lấy từ header Content-Type: multipart/form-data; boundary=XXXX */
export function boundaryFromContentType(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return m ? (m[1] ?? m[2]).trim() : null;
}

export function parseMultipart(body: Buffer, boundary: string): Part[] {
  const parts: Part[] = [];
  const delim = Buffer.from(`--${boundary}`);

  const positions: number[] = [];
  let idx = body.indexOf(delim, 0);
  while (idx !== -1) {
    positions.push(idx);
    idx = body.indexOf(delim, idx + delim.length);
  }

  for (let i = 0; i < positions.length - 1; i++) {
    let start = positions[i] + delim.length;
    if (body[start] === 0x2d && body[start + 1] === 0x2d) continue; // "--" → delim đóng, bỏ
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2; // bỏ \r\n sau delim
    let end = positions[i + 1];
    if (body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2;   // bỏ \r\n trước delim kế

    const seg = body.subarray(start, end);
    const sep = seg.indexOf(CRLFCRLF);
    if (sep === -1) continue;
    const headerStr = seg.subarray(0, sep).toString("utf8");
    const data = seg.subarray(sep + CRLFCRLF.length);

    const cd = /content-disposition:[^\r\n]*?name="([^"]*)"(?:[^\r\n]*?filename="([^"]*)")?/i.exec(headerStr);
    if (!cd) continue;
    const ct = /content-type:\s*([^\r\n]+)/i.exec(headerStr);
    parts.push({
      name: cd[1],
      filename: cd[2] || undefined,
      contentType: ct?.[1]?.trim(),
      data,
    });
  }
  return parts;
}
