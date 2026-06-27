// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Resolved Navigation — phần THUẦN (testable, không DOM/fetch).
 * shouldIntercept: có nên chặn click để SPA-nav không. createPrefetchCache: cache props
 * theo URL + dedup in-flight (prefetch on hover → nav cảm giác tức thì). */

export interface PageProps {
  cell: string;
  data: unknown;
  layout?: string;
}

interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

interface AnchorLike {
  href: string;
  target?: string;
  origin: string;     // location.origin hiện tại
  download?: boolean;
}

/* Chỉ chặn để SPA-nav khi: chuột trái, không phím bổ trợ, cùng origin, không _blank/download.
 * Còn lại → để browser điều hướng thường (progressive enhancement: JS tắt vẫn chạy <a>). */
export function shouldIntercept(e: ClickLike, a: AnchorLike): boolean {
  if (e.defaultPrevented) return false;
  if (e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (a.download) return false;
  if (a.target && a.target !== "" && a.target !== "_self") return false;
  let u: URL;
  try {
    u = new URL(a.href, a.origin);
  } catch {
    return false;
  }
  if (u.origin !== a.origin) return false; // external
  return true;
}

export interface PrefetchCache {
  has(url: string): boolean;
  peek(url: string): PageProps | undefined;
  load(url: string, fetcher: (u: string) => Promise<PageProps>): Promise<PageProps>;
  clear(url?: string): void;
  size(): number;
}

export function createPrefetchCache(): PrefetchCache {
  const done = new Map<string, PageProps>();
  const inflight = new Map<string, Promise<PageProps>>();

  return {
    has: (url) => done.has(url),
    peek: (url) => done.get(url),
    load(url, fetcher) {
      const cached = done.get(url);
      if (cached) return Promise.resolve(cached);
      let p = inflight.get(url);
      if (!p) {
        p = fetcher(url).then(
          (r) => { done.set(url, r); inflight.delete(url); return r; },
          (e) => { inflight.delete(url); throw e; },
        );
        inflight.set(url, p);
      }
      return p;
    },
    clear(url) {
      if (url) done.delete(url);
      else done.clear();
    },
    size: () => done.size,
  };
}
