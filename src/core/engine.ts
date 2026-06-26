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
  hydration: Hydration;
  loader: Loader<I, O>;
  view: ComponentType<{ data: O }>;
  actions?: Record<string, Action<any, any>>;
  head?: (data: O) => HeadMeta;   // SEO: title/meta/canonical/og/jsonLd per cell
  layout?: string;                // id layout bọc view (nested qua parent)
  requireAuth?: boolean;          // guard: cần session hợp lệ mới vào
}

export function defineCell<I, O>(c: CellDef<I, O>): CellDef<I, O> { return c; }
