import { createElement as h } from "react";
import { hydrateRoot } from "react-dom/client";
import { fetchPageProps } from "./core/client";
import { layoutChain } from "./core/layouts";
import { layouts } from "./layouts/index";
import home from "./cells/home/index";
import todos from "./cells/todos/index";

const registry: Record<string, any> = { home, todos };

const boot = (window as any).__FLUXE__;
if (boot) {
  const cell = registry[boot.cell];
  const el = document.getElementById("root");
  if (cell && el) {
    // Bọc layout y hệt SSR để khớp hydration (tránh mismatch).
    let node: any = h(cell.view, { data: boot.data });
    for (const id of layoutChain(cell.layout, layouts)) node = h(layouts[id].component, { children: node });
    hydrateRoot(el, node);
  }
}
