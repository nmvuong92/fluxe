// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Storage Adapter — interface chuẩn để SWITCH driver lưu file (như Backend).
 * Cell/endpoint chỉ biết interface này; đổi local ↔ S3 ↔ … = thay implementation. */

export interface PutResult {
  key: string;
  url: string;
  size: number;
}

export interface GetResult {
  data: Buffer;
  contentType?: string;
  size: number;
}

export interface Storage {
  name: string;
  put(key: string, data: Buffer, opts?: { contentType?: string }): Promise<PutResult>;
  get(key: string): Promise<GetResult | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

/* Làm sạch tên file → key an toàn (không slash, không '..', chỉ [A-Za-z0-9._-]). */
export function safeKey(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;            // bỏ path
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.{2,}/g, "_");
  return clean.slice(0, 120) || "file";
}

/* Sinh key duy nhất: <randomHex>-<safeName>. randomHex truyền vào để thuần (test dễ). */
export function makeKey(filename: string, randomHex: string): string {
  return `${randomHex}-${safeKey(filename)}`;
}
