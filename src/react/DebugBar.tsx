// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createElement as h, useState, useSyncExternalStore } from "react";
import { debug, type DebugEvent, type EventKind } from "./store";
import { setChaos, getChaos, sseLive } from "../core/client";
import { queryStats } from "./query";
import { reproTest } from "./repro";

const EMPTY: DebugEvent[] = [];
const DOT: Record<string, string> = { pending: "#e3b341", ok: "#3fb950", error: "#f85149" };
const KIND_COL: Record<string, string> = { query: "#5fd3f0", mutation: "#d2a8ff", subscription: "#a371f7", error: "#f85149" };
const CHAOS = "delay=600;fail=0.4";
type Filter = EventKind | "all";
const FILTERS: Filter[] = ["all", "query", "mutation", "subscription", "error"];

function useEvents(): DebugEvent[] {
  return useSyncExternalStore(debug.subscribe, debug.getSnapshot, () => EMPTY);
}

const ctrlBtn = (active: boolean): any => ({
  background: active ? "#1f6feb" : "#21262d", color: "#e6edf3", border: "1px solid #30363d",
  borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11,
});

export function DebugBar() {
  const events = useEvents();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [, force] = useState(0);             // re-render khi đổi chaos/backend
  const [copied, setCopied] = useState(false);
  const errs = events.filter((e) => e.status === "error").length;
  const shown = filter === "all" ? events : events.filter((e) => e.kind === filter || (filter === "error" && e.status === "error"));

  const wrap: any = { position: "fixed", right: 12, bottom: 12, zIndex: 99999, font: "12px ui-monospace,monospace" };

  if (!open) {
    return h("div", { style: wrap },
      h("button", {
        onClick: () => setOpen(true),
        style: { background: errs ? "#3d1417" : "#161b22", color: "#e6edf3", border: "1px solid #30363d", borderRadius: 999, padding: "6px 12px", cursor: "pointer", boxShadow: "0 4px 16px #0008" },
      }, `⚡ fluxe · ${events.length}${errs ? ` · ${errs}✗` : ""}`));
  }

  const chaosOn = getChaos() !== "";

  // Live RCA state: query mounted/cached/inflight + SSE đang mở (đọc registry trực tiếp).
  const stats = queryStats();
  const live = h("div", { style: { display: "flex", gap: 10, padding: "4px 10px", background: "#0d1117", borderBottom: "1px solid #21262d", color: "#7d8590", fontSize: 10 } },
    h("span", null, `▣ ${stats.mounted} query`),
    h("span", null, `◷ ${stats.cached} cached`),
    stats.inflight ? h("span", { style: { color: "#e3b341" } }, `↻ ${stats.inflight} bay`) : null,
    h("span", { style: { color: sseLive() ? "#a371f7" : "#7d8590" } }, `⌁ ${sseLive()} SSE`),
  );

  // #1 Chaos toggle + filter theo kind + clear
  const chip = (fl: Filter) => h("button", { key: fl, onClick: () => setFilter(fl),
    style: { ...ctrlBtn(filter === fl), padding: "1px 6px", textTransform: "capitalize", color: filter === fl ? "#e6edf3" : (KIND_COL[fl] ?? "#e6edf3") } }, fl);
  const controls = h("div", { style: { display: "flex", gap: 6, alignItems: "center", padding: "6px 10px", background: "#0d1117", borderBottom: "1px solid #21262d", flexWrap: "wrap" } },
    ...FILTERS.map(chip),
    h("span", { style: { flex: 1 } }),
    h("button", { onClick: () => { setChaos(chaosOn ? "" : CHAOS); force((x) => x + 1); }, style: ctrlBtn(chaosOn), title: CHAOS }, chaosOn ? "🔥 Chaos" : "Chaos"),
    h("button", { onClick: () => { debug.clear(); setSel(null); }, style: ctrlBtn(false), title: "Xoá log" }, "Clear"),
  );

  const rows = shown.length === 0
    ? [h("div", { key: "e", style: { color: "#7d8590", padding: 8 } }, "Tương tác đi — query/mutation/subscription sẽ hiện ở đây.")]
    : shown.map((e) =>
        h("div", { key: e.id, onClick: () => { setSel(sel === e.id ? null : e.id); setCopied(false); },
          style: { display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", cursor: "pointer", borderBottom: "1px solid #21262d", background: sel === e.id ? "#161b22" : "transparent" } },
          h("span", { style: { width: 8, height: 8, borderRadius: 8, background: DOT[e.status], flexShrink: 0 } }),
          h("span", { style: { color: KIND_COL[e.kind] ?? "#7d8590", textTransform: "uppercase", fontSize: 10, width: 50 } }, e.kind),
          h("span", { style: { color: "#e6edf3", flex: 1 } }, e.label),
          e.resolution ? h("span", { style: { color: "#5fd3f0", fontSize: 10 } }, e.resolution) : null,  // #3 RCA
          h("span", { style: { color: "#7d8590", width: 44, textAlign: "right" } }, e.ms != null ? `${e.ms}ms` : "…"),
        ));

  // #4 trace (timing bars) + repro→test (#2)
  let detail: any = null;
  if (sel != null) {
    const e = events.find((x) => x.id === sel);
    if (e) {
      const scale = Math.max(1, e.ms ?? 1);
      const bar = (label: string, ms: number | undefined, color: string) => ms == null ? null :
        h("div", { style: { display: "flex", gap: 6, alignItems: "center", margin: "2px 0" } },
          h("span", { style: { color: "#7d8590", width: 60 } }, label),
          h("div", { style: { height: 8, width: `${Math.max(4, (ms / scale) * 200)}px`, background: color, borderRadius: 3 } }),
          h("span", { style: { color: "#7d8590" } }, `${ms}ms`));
      detail = h("div", { style: { padding: 8, borderTop: "1px solid #30363d" } },
        e.resolution ? h("div", { style: { color: "#5fd3f0", marginBottom: 4 } }, `resolution: ${e.resolution}`) : null,
        bar("server", e.serverMs, "#3fb950"),
        bar("client", e.ms, "#1f6feb"),
        h("pre", { style: { margin: "6px 0 0", maxHeight: 120, overflow: "auto", color: "#a5d6ff", whiteSpace: "pre-wrap" } },
          e.error ? "ERROR: " + e.error : JSON.stringify(e.data, null, 2)),
        e.kind === "mutation" ? h("button", {
          onClick: () => { try { (navigator as any).clipboard?.writeText(reproTest(e as any)); setCopied(true); } catch {} },
          style: { ...ctrlBtn(false), marginTop: 6 },
        }, copied ? "✓ đã copy test" : "📋 Copy as test") : null,
      );
    }
  }

  return h("div", { style: wrap },
    h("div", { style: { width: 380, background: "#0d1117", border: "1px solid #30363d", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px #000a" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#161b22", color: "#e6edf3" } },
        h("b", null, "⚡ fluxe devtools"),
        h("button", { onClick: () => setOpen(false), style: { background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 14 } }, "✕")),
      controls,
      live,
      h("div", { style: { maxHeight: 220, overflow: "auto" } }, ...rows),
      detail,
    ));
}
