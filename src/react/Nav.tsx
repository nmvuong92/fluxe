// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* <Nav/> — render menu khai báo (app/nav.ts) bằng <Link>. Active set bởi shellScript (vanilla)
 * theo path → chạy cả trên trang static. <Link> cho SPA nav trên trang island. */
import { Link } from "./Link";

export interface NavItem {
  label: string;
  href: string;
}

export function Nav({ items, className }: { items: NavItem[]; className?: string }) {
  return (
    <nav className={className ?? "nav"}>
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="nav-link">
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
