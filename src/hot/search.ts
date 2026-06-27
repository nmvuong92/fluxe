// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Adapter TS cho hot-path Rust search — SAU một biên riêng (không phải Backend CRUD).
 * Cell/loader chỉ gọi interface này; phía sau là service Rust compute. */
export interface SearchHit { item: string; score: number }

export interface SearchService {
  name: string;
  search(items: string[], query: string): Promise<SearchHit[]>;
}

export function createRustSearch(baseUrl: string): SearchService {
  const base = baseUrl.replace(/\/$/, "");
  return {
    name: "rust-hot",
    async search(items, query) {
      const r = await fetch(`${base}/search?q=${encodeURIComponent(query)}`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: items.join("\n"),
      });
      if (!r.ok) throw new Error(`hot search → HTTP ${r.status}`);
      return (await r.json()) as SearchHit[];
    },
  };
}
