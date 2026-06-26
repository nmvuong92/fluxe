import { createElement as h, Fragment, type ReactNode } from "react";
import type { LayoutMeta } from "../../src/core/layouts";
import { DebugBar } from "../../src/react";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode }) => ReactNode;
}

// site (ngoài cùng) ← app (trong). Áp app → render site(app(cell)). DebugBar mount ở site.
export const layouts: Record<string, LayoutEntry> = {
  site: {
    id: "site",
    component: ({ children }) =>
      h(Fragment, null,
        h("div", { className: "site" },
          h("header", { className: "site-header" }, "fluxe site"),
          children),
        h(DebugBar as any, null)),
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
