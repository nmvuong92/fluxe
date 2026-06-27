// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineCell, createCells, type RouteParams } from "./engine.ts";

// ── Type-level: RouteParams suy đúng (kiểm bởi bước typecheck của test:all) ──
type _A = RouteParams<"/">;                       // {}
type _B = RouteParams<"/user/[id]">;              // { id: string }
type _C = RouteParams<"/u/[id]/post/[slug]">;     // { id: string; slug: string }
const _a: _A = {};
const _b: _B = { id: "1" };
const _c: _C = { id: "1", slug: "x" };

test("typed routes: defineCell suy input từ route + O từ loader", () => {
  const cell = defineCell({
    id: "u", route: "/user/[id]/post/[slug]",
    async loader({ input }) {
      const id: string = input.id;       // suy từ route — compile OK
      const slug: string = input.slug;   // suy từ route — compile OK
      // @ts-expect-error — param không có trong route
      const _bad: string = input.nope;
      return { id, slug };
    },
    view: () => null,
  });
  assert.equal(cell.route, "/user/[id]/post/[slug]");
  assert.equal(typeof cell.loader, "function");
});

test("createCells<B>(): bind backend type, vẫn suy route", () => {
  const defineTyped = createCells<{ hi(): string }>();
  const cell = defineTyped({
    id: "c", route: "/c/[k]",
    async loader({ input, backend }) {
      const k: string = input.k;         // route suy
      const v: string = backend.hi();    // backend typed từ factory
      return { k, v };
    },
    view: () => null,
  });
  assert.equal(cell.id, "c");
});

void _a; void _b; void _c;
