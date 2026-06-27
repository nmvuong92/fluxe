// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Client nav controller — wire phần thuần (nav.ts) với DOM/history/fetch.
 * KHÔNG import cells/router (giữ client bundle sạch server code) → "internal?" = cùng origin +
 * server trả về cell hợp lệ. window/history/location chỉ đụng trong hàm (an toàn SSR import). */
import { fetchPageProps } from "../core/client";
import { createPrefetchCache, shouldIntercept } from "../core/nav";

type Swap = (cell: string, data: unknown, layout?: string) => void;

let onSwap: Swap | null = null;
const cache = createPrefetchCache();

const pathOf = (href: string): string => {
  try { const u = new URL(href, location.origin); return u.pathname + u.search; } catch { return href; }
};
const sameOrigin = (href: string): boolean => {
  try { return new URL(href, location.origin).origin === location.origin; } catch { return false; }
};

export function initNav(swap: Swap) {
  onSwap = swap;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("popstate", () => { void go(location.pathname + location.search, false); });
  (window as any).fluxe = { navigate, prefetch };   // API điều hướng programmatic
}

function saveScroll() {
  history.replaceState({ ...(history.state ?? {}), scrollY: window.scrollY }, "");
}
function restoreScroll(y: number) {
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
}

/* Prefetch (hover): nạp trước props link cùng origin vào cache → click sau cảm giác tức thì. */
export function prefetch(href: string) {
  if (!sameOrigin(href)) return;
  void cache.load(pathOf(href), fetchPageProps).catch(() => {});
}

export interface NavOptions {
  preserveScroll?: boolean;
}

/* Điều hướng: cùng origin → thử SPA swap; server trả non-cell / lỗi → để browser (hard nav). */
export async function go(href: string, push = true, opts: NavOptions = {}): Promise<void> {
  if (!sameOrigin(href)) { location.href = href; return; }
  const path = pathOf(href);
  let props;
  try { props = await cache.load(path, fetchPageProps); }
  catch { location.href = href; return; }
  if (!props || !props.cell) { location.href = href; return; }   // không phải cell (file tĩnh…) → hard nav
  if (push) {
    saveScroll();
    history.pushState({ fluxe: 1, scrollY: opts.preserveScroll ? window.scrollY : 0 }, "", href);
  }
  onSwap?.(props.cell, props.data, props.layout);
  window.dispatchEvent(new Event("fluxe:nav"));    // cho <Nav/> cập nhật active
  if (opts.preserveScroll) return;
  restoreScroll(push ? 0 : (history.state?.scrollY ?? 0));
}

export function navigate(href: string, opts: NavOptions = {}): Promise<void> {
  return go(href, true, opts);
}

export { shouldIntercept };
