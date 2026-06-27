// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { ComponentType } from "react";
import type { Backend } from "../backends/types";
import type { HeadMeta } from "./seo";
import type { Session } from "./auth";

/* ============================================================
 * fluxe core
 * ============================================================ */
export interface Ctx<I> {
  input: I;
  backend: Backend;            // ← backend được inject, cell không biết loại gì
  session?: Session | null;    // ← session đã verify (null/undefined nếu chưa đăng nhập)
}
export type Loader<I, O> = (ctx: Ctx<I>) => Promise<O>;
export type Action<I, O> = (ctx: Ctx<I>) => Promise<O>;

export type Hydration = "static" | "island";

export interface CellDef<I, O> {
  id: string;
  route: string;
  hydration?: Hydration;          // MẶC ĐỊNH "island". Khai báo "static" để opt-in tối ưu 0-JS.
  loader: Loader<I, O>;
  view: ComponentType<{ data: O }>;
  actions?: Record<string, Action<any, any>>;
  head?: (data: O) => HeadMeta;   // SEO: title/meta/canonical/og/jsonLd per cell
  layout?: string;                // id layout bọc view (nested qua parent)
  requireAuth?: boolean;          // guard: cần session hợp lệ mới vào
  requireRole?: string;           // guard RBAC: cần role này (ngầm cần auth)
  cache?: boolean;                // render cache cho cell static (mặc định true); đặt false nếu cell STREAM (Suspense)
}

export function defineCell<I, O>(c: CellDef<I, O>): CellDef<I, O> { return c; }
