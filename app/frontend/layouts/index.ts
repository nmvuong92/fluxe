// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { LayoutMeta } from "@nmvuong92/fluxe";
import type { ReactNode } from "react";
import Site from "./site";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode; ctx?: any }) => ReactNode;
}

export const layouts: Record<string, LayoutEntry> = {
  site: { id: "site", component: Site },
};
