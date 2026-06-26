import { createElement as h } from "react";
import { hydrateRoot } from "react-dom/client";
import { fetchPageProps } from "./core/client";
import home from "./cells/home/index";
import todos from "./cells/todos/index";

const registry: Record<string, any> = { home, todos };

const boot = (window as any).__FLUXE__;
if (boot) {
  const cell = registry[boot.cell];
  const el = document.getElementById("root");
  if (cell && el) hydrateRoot(el, h(cell.view, { data: boot.data }));
}
