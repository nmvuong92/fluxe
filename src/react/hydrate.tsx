// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* hydrate(views, layouts) — bootstrap client bundle cho MỘT project fluxe. Project sinh
 * `frontend/client.tsx` gọi hàm này với views/layouts của nó → 0 hardcode đường dẫn app trong engine. */
import { createElement, useState, useEffect, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { layoutChain } from "../core/layouts";
import { initNav } from "./nav-client";

type Views = Record<string, (props: { data: unknown }) => ReactNode>;

export function hydrate(views: Views, layouts: Record<string, any>) {
  // Render view của cell + bọc layout (layout id do SERVER gửi kèm payload).
  function renderPage(cellId: string, data: unknown, layoutId?: string): ReactNode {
    const View = views[cellId];
    if (!View) return null;
    let node: ReactNode = <View data={data} />;
    // createElement (bất khả JSX): bọc động theo chuỗi layout id runtime.
    for (const id of layoutChain(layoutId, layouts)) node = createElement(layouts[id].component, { children: node });
    return node;
  }

  function Root({ initial }: { initial: { cell: string; data: unknown; layout?: string } }) {
    const [page, setPage] = useState(initial);
    useEffect(() => { initNav((cell, data, layout) => setPage({ cell, data, layout })); }, []);
    return renderPage(page.cell, page.data, page.layout);
  }

  const boot = (window as any).__FLUXE__;
  if (boot && views[boot.cell]) {
    const el = document.getElementById("root");
    if (el) hydrateRoot(el, <Root initial={boot} />);
  }
}
