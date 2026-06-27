// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* ============================================================
 * Render cache — memoize HTML đã render của cell static, key theo route.
 *
 * Tối ưu "zero-copy kiểu Node": render React 1 lần → giữ Buffer → mọi request
 * sau ghi LẠI đúng buffer đó (res.end), bỏ qua renderToPipeableStream (đắt ~1 lõi).
 *
 * Behavior-preserving: mỗi entry gắn `etag` của data sinh ra nó. Caller chỉ dùng
 * buffer khi etag khớp data hiện tại → data đổi ⇒ miss ⇒ render lại (không trả HTML cũ).
 *
 * Bound bộ nhớ bằng LRU (route động như /hello/[name] có không gian key vô hạn —
 * không bound sẽ rò RAM). DSA: Hash Table + danh sách LRU, get/set O(1).
 * ============================================================ */

export interface RenderEntry {
  etag: string;
  buf: Buffer;
}

export interface RenderCache {
  /** Lấy entry theo key (đánh dấu vừa dùng — LRU). undefined nếu chưa có. */
  get(key: string): RenderEntry | undefined;
  /** Lưu/ghi đè entry; evict key cũ nhất nếu vượt maxKeys. */
  set(key: string, entry: RenderEntry): void;
  /** Số entry hiện giữ (≤ maxKeys) — cho test/quan sát. */
  size(): number;
}

export function createRenderCache(opts: { maxKeys?: number } = {}): RenderCache {
  const maxKeys = opts.maxKeys ?? 256;
  // Map giữ thứ tự chèn → key đầu tiên = ít-dùng-gần-đây nhất (LRU).
  const m = new Map<string, RenderEntry>();

  return {
    get(key) {
      const e = m.get(key);
      if (e === undefined) return undefined;
      m.delete(key);   // chạm vào → đẩy lên "mới dùng" (cuối Map)
      m.set(key, e);
      return e;
    },
    set(key, entry) {
      if (m.has(key)) m.delete(key);
      m.set(key, entry);
      while (m.size > maxKeys) {
        const oldest = m.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        m.delete(oldest);
      }
    },
    size: () => m.size,
  };
}
