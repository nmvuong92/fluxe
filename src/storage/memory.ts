// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Storage, GetResult } from "./types.ts";

/* Driver in-RAM (dev/test). 0 đĩa, mất khi restart. */
export function createMemoryStorage(baseUrl = "/__file"): Storage {
  const m = new Map<string, GetResult>();
  const u = (key: string) => `${baseUrl}/${encodeURIComponent(key)}`;
  return {
    name: "memory",
    async put(key, data, opts) {
      m.set(key, { data, contentType: opts?.contentType, size: data.length });
      return { key, url: u(key), size: data.length };
    },
    async get(key) {
      return m.get(key) ?? null;
    },
    async delete(key) {
      m.delete(key);
    },
    url: u,
  };
}
