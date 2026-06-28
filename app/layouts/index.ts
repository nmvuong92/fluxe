import { createElement as h, Fragment, type ReactNode } from "react";
import type { LayoutMeta } from "../../src/core/layouts";
import { DebugBar, LocaleSwitch } from "../../src/react";
import { NotifBell } from "../notif-bell";
import { AuthStatus } from "../auth-status";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode; ctx?: any }) => ReactNode;
}

// site (ngoài cùng) ← app (trong). Áp app → render site(app(cell)). DebugBar mount ở site.
export const layouts: Record<string, LayoutEntry> = {
  site: {
    id: "site",
    component: ({ children, ctx }) =>
      h(Fragment, null,
        h("div", { className: "site" },
          h("header", { className: "site-header" },
            "fluxe site",
            h(LocaleSwitch as any, { locales: ["vi", "en"], current: ctx?.locale }),
            h(AuthStatus as any, null),
            h(NotifBell as any, null)),
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
