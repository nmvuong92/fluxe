import { createElement as h, Suspense } from "react";

export function delay(ms: number, value: string): Promise<string> {
  return new Promise((r) => setTimeout(() => r(value), ms));
}

// use()-polyfill: đọc promise, throw tới khi resolve → Suspense stream khi xong.
function read(p: any): string {
  if (p.status === "fulfilled") return p.value;
  if (p.status === "rejected") throw p.reason;
  if (!p.status) {
    p.status = "pending";
    p.then((v: string) => { p.status = "fulfilled"; p.value = v; }, (e: any) => { p.status = "rejected"; p.reason = e; });
  }
  throw p;
}

function Slow({ promise }: { promise: Promise<string> }) {
  return h("p", { id: "slow-content" }, read(promise));
}

export interface SlowData { slow: Promise<string> }

export function SlowView({ data }: { data: SlowData }) {
  return h("div", { className: "card" },
    h("h1", null, "Streaming SSR"),
    h("p", { id: "shell-marker" }, "shell gửi ngay"),
    h(Suspense, { fallback: h("p", { id: "fallback" }, "đang tải...") },
      h(Slow, { promise: data.slow }))
  );
}

export default SlowView;
