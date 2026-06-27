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
export interface Ctx<I, B = any> {
  input: I;
  backend: B;                  // ← backend user-owned (app/backend.ts), inject qua makeServer
  session?: Session | null;    // ← session đã verify (null/undefined nếu chưa đăng nhập)
  locale?: string;             // ← i18n: locale đã giải (cookie/Accept-Language)
  t?: TFn;                     // ← i18n: t(key, vars) bound theo locale; dịch trong loader
}
export type Loader<I, O, B = any> = (ctx: Ctx<I, B>) => Promise<O>;
export type Action<I, O, B = any> = (ctx: Ctx<I, B>) => Promise<O>;

export type Hydration = "static" | "island";

export interface CellDef<I, O, B = any> {
  id: string;
  route: string;
  hydration?: Hydration;          // MẶC ĐỊNH "island". Khai báo "static" để opt-in tối ưu 0-JS.
  loader: Loader<I, O, B>;
  view: ComponentType<{ data: O }>;
  actions?: Record<string, Action<any, any, B>>;
  head?: (data: O) => HeadMeta;   // SEO: title/meta/canonical/og/jsonLd per cell
  layout?: string;                // id layout bọc view (nested qua parent)
  requireAuth?: boolean;          // guard: cần session hợp lệ mới vào
  requireRole?: string;           // guard RBAC: cần role này (ngầm cần auth)
  cache?: boolean;                // render cache cho cell static (mặc định true); đặt false nếu cell STREAM (Suspense)
}

export function defineCell<I, O, B = any>(c: CellDef<I, O, B>): CellDef<I, O, B> { return c; }
