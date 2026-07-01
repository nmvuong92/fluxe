// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createElement as h, useState, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { layoutChain } from "./core/layouts";
import { layouts } from "../app/frontend/layouts/index";
import { views } from "../app/frontend/views";          // CHỈ view (không loader/actions/backend → không lọt xuống client)
import { initNav } from "./react/nav-client";

// Render view của cell + bọc layout (layout id do SERVER gửi kèm payload — client không cần biết cell config).
function renderPage(cellId: string, data: unknown, layoutId?: string) {
  const View = views[cellId];
  if (!View) return null;
  let node: any = h(View, { data });
  for (const id of layoutChain(layoutId, layouts)) node = h(layouts[id].component, { children: node });
  return node;
}

// Root có state {cell,data,layout} → SPA nav đổi state → re-render (không full reload).
function Root({ initial }: { initial: { cell: string; data: unknown; layout?: string } }) {
  const [page, setPage] = useState(initial);
  useEffect(() => {
    initNav((cell, data, layout) => setPage({ cell, data, layout }));
  }, []);
  return renderPage(page.cell, page.data, page.layout);
}

const boot = (window as any).__FLUXE__;
if (boot && views[boot.cell]) {
  const el = document.getElementById("root");
  if (el) hydrateRoot(el, h(Root, { initial: boot }));
}
