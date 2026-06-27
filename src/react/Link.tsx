// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* <Link> — điều hướng tối ưu theo cell. Render <a href> bình thường (SSR + JS-tắt vẫn chạy);
 * khi có JS: hover → prefetch, click trái nội bộ → SPA swap (chặn full reload). */
import type { ReactNode } from "react";
import { go, prefetch, shouldIntercept } from "./nav-client";

interface LinkProps {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  preserveScroll?: boolean;   // giữ nguyên scroll khi nav (lọc/phân trang tại chỗ)
  className?: string;
  target?: string;
  download?: boolean;
}

export function Link({ href, children, prefetch: pf = true, preserveScroll, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      onMouseEnter={pf ? () => prefetch(href) : undefined}
      onClick={(e) => {
        const origin = typeof location !== "undefined" ? location.origin : "";
        if (shouldIntercept(e.nativeEvent, { href, origin, target: rest.target, download: rest.download })) {
          e.preventDefault();
          void go(href, true, { preserveScroll });
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
