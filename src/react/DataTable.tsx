// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* <DataTable> — view template tái dùng: bảng từ rows + columns (typed theo T). Thuần (0 hook) →
 * dùng được cả SSR lẫn island. Bỏ boilerplate <table><thead>… mỗi list. Kết hợp api.x.useQuery(). */
import { createElement as h, type ReactNode } from "react";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;   // mặc định: in row[key]
}

export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  empty = "Không có dữ liệu.",
  className = "list",
}: {
  rows: T[];
  columns: Column<T>[];
  empty?: string;
  className?: string;
}) {
  return h("table", { className, style: { width: "100%" } },
    h("thead", null,
      h("tr", null, columns.map((c) => h("th", { key: c.key, align: c.align ?? "left" }, c.label)))),
    h("tbody", null,
      rows.length === 0
        ? h("tr", null, h("td", { colSpan: columns.length, className: "muted" }, empty))
        : rows.map((row) =>
            h("tr", { key: String(row.id) },
              columns.map((c) =>
                h("td", { key: c.key, align: c.align ?? "left" },
                  c.render ? c.render(row) : (row[c.key] as ReactNode)))))),
  );
}

export default DataTable;
