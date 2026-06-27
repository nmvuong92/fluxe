// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { CellDef } from "./engine";

export interface RouteMatch {
  cell: CellDef<any, any>;
  params: Record<string, string>;
}

interface Compiled {
  cell: CellDef<any, any>;
  regex: RegExp;
  paramNames: string[];
}

const ESC = /[.*+?^${}()|[\]\\]/g;

function compile(cell: CellDef<any, any>): { isStatic: boolean; compiled: Compiled } {
  const paramNames: string[] = [];
  let isStatic = true;
  const parts = cell.route.split("/").map((seg) => {
    const m = seg.match(/^\[(.+)\]$/);
    if (m) {
      isStatic = false;
      paramNames.push(m[1]);
      return "([^/]+)";
    }
    return seg.replace(ESC, "\\$&");
  });
  return { isStatic, compiled: { cell, regex: new RegExp("^" + parts.join("/") + "$"), paramNames } };
}

// Trả về matcher: static exact (Map, O(1)) trước, dynamic param sau (precedence).
export function makeRouter(cells: CellDef<any, any>[]): (pathname: string) => RouteMatch | null {
  const staticMap = new Map<string, CellDef<any, any>>();
  const dynamic: Compiled[] = [];
  for (const cell of cells) {
    const { isStatic, compiled } = compile(cell);
    if (isStatic) staticMap.set(cell.route, cell);
    else dynamic.push(compiled);
  }

  return (pathname: string): RouteMatch | null => {
    const s = staticMap.get(pathname);
    if (s) return { cell: s, params: {} };
    for (const d of dynamic) {
      const m = d.regex.exec(pathname);
      if (m) {
        const params: Record<string, string> = {};
        d.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
        return { cell: d.cell, params };
      }
    }
    return null;
  };
}
