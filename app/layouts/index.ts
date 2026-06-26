import { createElement as h, type ReactNode } from "react";
import type { LayoutMeta } from "../../src/core/layouts";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode }) => ReactNode;
}

// site (ngoài cùng) ← app (trong). Áp app → render site(app(cell)).
export const layouts: Record<string, LayoutEntry> = {
  site: {
    id: "site",
    component: ({ children }) =>
      h("div", { className: "site" },
        h("header", { className: "site-header" }, "fluxe site"),
        children),
  },
  app: {
    id: "app",
    parent: "site",
    component: ({ children }) =>
      h("div", { className: "app" },
        h("nav", { className: "app-nav" }, "app nav"),
        children),
  },
};
