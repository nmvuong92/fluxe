import { createElement as h, useState, useSyncExternalStore } from "react";
import { debug, type DebugEvent } from "./store";

const EMPTY: DebugEvent[] = [];
const DOT: Record<string, string> = { pending: "#e3b341", ok: "#3fb950", error: "#f85149" };

function useEvents(): DebugEvent[] {
  return useSyncExternalStore(debug.subscribe, debug.getSnapshot, () => EMPTY);
}

/* DebugBar — thanh debug nổi (full flow + tracing). Mount 1 lần là xong. */
export function DebugBar() {
  const events = useEvents();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const errs = events.filter((e) => e.status === "error").length;

  const wrap: any = { position: "fixed", right: 12, bottom: 12, zIndex: 99999, font: "12px ui-monospace,monospace" };

  const pill = h("button", {
    onClick: () => setOpen((o) => !o),
    style: {
      background: errs ? "#3d1417" : "#161b22", color: "#e6edf3", border: "1px solid #30363d",
      borderRadius: 999, padding: "6px 12px", cursor: "pointer", boxShadow: "0 4px 16px #0008",
    },
  }, `⚡ fluxe · ${events.length} events${errs ? ` · ${errs} ✗` : ""}`);

  if (!open) return h("div", { style: wrap }, pill);

  const rows = events.length === 0
    ? [h("div", { key: "e", style: { color: "#7d8590", padding: 8 } }, "Chưa có sự kiện — bấm Thêm/Toggle thử.")]
    : events.map((e) =>
        h("div", {
          key: e.id,
          onClick: () => setSel(sel === e.id ? null : e.id),
          style: { display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", cursor: "pointer", borderBottom: "1px solid #21262d" },
        },
          h("span", { style: { width: 8, height: 8, borderRadius: 8, background: DOT[e.status], flexShrink: 0 } }),
          h("span", { style: { color: "#7d8590", textTransform: "uppercase", fontSize: 10, width: 56 } }, e.kind),
          h("span", { style: { color: "#e6edf3", flex: 1 } }, e.label),
          h("span", { style: { color: "#7d8590" } }, e.ms != null ? `${e.ms}ms` : "…"),
        ));

  const detail = sel != null && (() => {
    const e = events.find((x) => x.id === sel);
    if (!e) return null;
    return h("pre", { style: { margin: 0, padding: 8, maxHeight: 160, overflow: "auto", color: "#a5d6ff", borderTop: "1px solid #30363d", whiteSpace: "pre-wrap" } },
      e.error ? "ERROR: " + e.error : JSON.stringify(e.data, null, 2));
  })();

  return h("div", { style: wrap },
    h("div", { style: { width: 340, background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px #000a" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161b22", color: "#e6edf3" } },
        h("b", null, "⚡ fluxe devtools"),
        h("button", { onClick: () => setOpen(false), style: { background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 14 } }, "✕"),
      ),
      h("div", { style: { maxHeight: 240, overflow: "auto" } }, ...rows),
      detail,
    ),
  );
}
