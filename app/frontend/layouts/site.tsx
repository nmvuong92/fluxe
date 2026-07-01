// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createElement as h, Fragment, type ReactNode } from "react";
import { LocaleSwitch, DebugBar } from "@nmvuong92/fluxe/react";

/* Layout site (ngoài cùng): header + LocaleSwitch (VI/EN) + DebugBar (DX). */
export function Site({ children, ctx }: { children: ReactNode; ctx?: any }) {
  return h(Fragment, null,
    h("main", { style: { maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" } },
      h("header", { style: { display: "flex", gap: 12, alignItems: "center", marginBottom: 24 } },
        h("strong", null, "fluxe"),
        h(LocaleSwitch as any, { locales: ["vi", "en"], current: ctx?.locale })),
      children),
    h(DebugBar as any, null));
}

export default Site;
