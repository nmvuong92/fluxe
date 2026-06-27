// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Storage } from "./types.ts";
import { safeKey } from "./types.ts";

/* Driver đĩa local — ghi dưới `dir`, serve qua baseUrl (/__file/<key>). Key được làm sạch
 * (safeKey) nên không thoát thư mục (path traversal). */
export function createLocalStorage(opts: { dir: string; baseUrl?: string }): Storage {
  const baseUrl = opts.baseUrl ?? "/__file";
  const pathOf = (key: string) => join(opts.dir, safeKey(key));   // chặn ../
  const u = (key: string) => `${baseUrl}/${encodeURIComponent(safeKey(key))}`;
  return {
    name: "local",
    async put(key, data, _opts) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, data);
      return { key: safeKey(key), url: u(key), size: data.length };
    },
    async get(key) {
      try {
        const data = await readFile(pathOf(key));
        return { data, size: data.length };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try { await unlink(pathOf(key)); } catch { /* không có thì thôi */ }
    },
    url: u,
  };
}
