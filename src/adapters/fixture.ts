// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Fixture dùng chung cho test adapter: 1 cell static "ping" → SSR ra "pong". */
import { createElement as h } from "react";
import { defineCell } from "../core/engine.ts";
import { resolve } from "../core/resolver.ts";

export const pingCell = defineCell({
  id: "ping",
  route: "/ping",
  hydration: "static",
  async loader() { return { msg: "pong" }; },
  view: ({ data }) => h("div", { id: "msg" }, data.msg),
});

export const cells = [pingCell];
export const manifest = resolve([{ id: "ping", route: "/ping", hydration: "static" }], { name: "test" });

export function getText(port: number, path: string): Promise<{ status: number; body: string }> {
  return fetch(`http://127.0.0.1:${port}${path}`).then(async (r) => ({ status: r.status, body: await r.text() }));
}
