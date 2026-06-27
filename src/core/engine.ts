// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { ComponentType } from "react";
import type { HeadMeta } from "./seo";
import type { TFn } from "./i18n";

/* Session = do HOST framework gắn vào req (fluxe không verify — cầu nối RCA). Shape tuỳ host;
 * mặc định { user, roles } để cell.requireRole đọc. */
export interface Session { user?: string; roles?: string[]; [k: string]: unknown }

/* ============================================================
 * fluxe core
 * `B` = backend của BẠN: định nghĩa interface domain ở app/backend.ts rồi truyền qua
 *   makeServer(..., { backend }). Mặc định `any` để cell không cần khai báo B nếu chưa cần.
 * ============================================================ */
export interface Ctx<I, B = any, S = Session> {
  input: I;
  backend: B;                  // ← backend user-owned (app/backend.ts), inject qua makeServer
  session?: S | null;          // ← session do HOST gắn (req.session); typed qua createCells<B,S>
  locale?: string;             // ← i18n: locale đã giải (cookie/Accept-Language)
  t?: TFn;                     // ← i18n: t(key, vars) bound theo locale; dịch trong loader
}
export type Loader<I, O, B = any, S = Session> = (ctx: Ctx<I, B, S>) => Promise<O>;
export type Action<I, O, B = any, S = Session> = (ctx: Ctx<I, B, S>) => Promise<O>;

export type Hydration = "static" | "island";

export interface CellDef<I, O, B = any, S = Session> {
  id: string;
  route: string;
  hydration?: Hydration;          // MẶC ĐỊNH "island". Khai báo "static" để opt-in tối ưu 0-JS.
  loader: Loader<I, O, B, S>;
  view: ComponentType<{ data: O }>;
  actions?: Record<string, Action<any, any, B, any>>;   // session-agnostic (withInput dùng default)
  head?: (data: O) => HeadMeta;   // SEO: title/meta/canonical/og/jsonLd per cell
  layout?: string;                // id layout bọc view (nested qua parent)
  requireAuth?: boolean;          // guard: cần session (host gắn) mới vào
  requireRole?: string;           // guard RBAC: cần role này (đọc session host)
  cache?: boolean;                // render cache cho cell static (mặc định true); đặt false nếu cell STREAM (Suspense)
}

/* Typed routes: trích param `[x]` từ route string → { x: string } (suy lúc compile, 0 khai báo tay).
 *   "/user/[id]/post/[slug]" → { id: string; slug: string } */
export type RouteParams<P extends string> =
  P extends `${string}[${infer K}]${infer R}` ? { [N in K | keyof RouteParams<R>]: string } : {};

// Config = CellDef nhưng `route` giữ literal R (để suy params); loader/O/view suy theo.
type CellConfig<R extends string, O, B, S> = Omit<CellDef<RouteParams<R>, O, B, S>, "route"> & { route: R };

/* defineCell — `ctx.input` SUY TỪ route, `O` suy từ loader. Backend/session = mặc định
 * (dùng createCells<B,S>() nếu muốn ctx.backend / ctx.session có kiểu). */
export function defineCell<const R extends string, O, B = any, S = Session>(c: CellConfig<R, O, B, S>): CellDef<RouteParams<R>, O, B, S> {
  return c as CellDef<RouteParams<R>, O, B, S>;
}

/* createCells<Backend, Session>() — bind kiểu backend + session MỘT lần (kiểu tRPC initTRPC). Trả về
 * defineCell có ctx.backend + ctx.session typed, vẫn suy route+O. Dùng ở app/cell.ts. */
export function createCells<B = any, S = Session>() {
  return <const R extends string, O>(c: CellConfig<R, O, B, S>): CellDef<RouteParams<R>, O, B, S> =>
    c as CellDef<RouteParams<R>, O, B, S>;
}
