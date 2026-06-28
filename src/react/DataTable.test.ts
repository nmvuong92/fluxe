// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type Column } from "./DataTable.tsx";

interface Row { id: string; name: string; n: number }
const cols: Column<Row>[] = [
  { key: "name", label: "Tên" },
  { key: "n", label: "Số", align: "right", render: (r) => "$" + r.n },
];

test("[datatable] render header + cell + custom render", () => {
  const html = renderToStaticMarkup(h(DataTable<Row>, { rows: [{ id: "1", name: "A", n: 5 }], columns: cols }));
  assert.match(html, /Tên/);
  assert.match(html, />A</);
  assert.match(html, /\$5/);            // custom render
});

test("[datatable] rows rỗng → empty text", () => {
  const html = renderToStaticMarkup(h(DataTable<Row>, { rows: [], columns: cols, empty: "trống" }));
  assert.match(html, /trống/);
});
