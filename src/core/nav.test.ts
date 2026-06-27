// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldIntercept, createPrefetchCache, type PageProps } from "./nav.ts";

const ORIGIN = "https://app.local";
const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

test("shouldIntercept: click trái nội bộ → CHẶN (SPA nav)", () => {
  assert.equal(shouldIntercept(plainClick, { href: "/todos", origin: ORIGIN }), true);
  assert.equal(shouldIntercept(plainClick, { href: ORIGIN + "/about", origin: ORIGIN }), true);
});

test("shouldIntercept: phím bổ trợ / chuột giữa → KHÔNG chặn (mở tab mới…)", () => {
  for (const mod of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
    assert.equal(shouldIntercept({ ...plainClick, [mod]: true }, { href: "/x", origin: ORIGIN }), false, mod);
  }
  assert.equal(shouldIntercept({ ...plainClick, button: 1 }, { href: "/x", origin: ORIGIN }), false);
});

test("shouldIntercept: external / _blank / download / preventDefault → KHÔNG chặn", () => {
  assert.equal(shouldIntercept(plainClick, { href: "https://other.com/x", origin: ORIGIN }), false);
  assert.equal(shouldIntercept(plainClick, { href: "/x", target: "_blank", origin: ORIGIN }), false);
  assert.equal(shouldIntercept(plainClick, { href: "/x", download: true, origin: ORIGIN }), false);
  assert.equal(shouldIntercept({ ...plainClick, defaultPrevented: true }, { href: "/x", origin: ORIGIN }), false);
});

test("prefetch cache: load 1 lần rồi dùng lại (fetcher gọi đúng 1)", async () => {
  const c = createPrefetchCache();
  let calls = 0;
  const fetcher = async (u: string): Promise<PageProps> => { calls++; return { cell: "todos", data: { u } }; };
  const a = await c.load("/todos", fetcher);
  const b = await c.load("/todos", fetcher);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.equal(c.has("/todos"), true);
  assert.equal(c.size(), 1);
});

test("prefetch cache: dedup in-flight (2 load song song → fetcher 1 lần)", async () => {
  const c = createPrefetchCache();
  let calls = 0;
  const fetcher = (u: string) => new Promise<PageProps>((res) => { calls++; setTimeout(() => res({ cell: "x", data: u }), 5); });
  const [a, b] = await Promise.all([c.load("/x", fetcher), c.load("/x", fetcher)]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});

test("prefetch cache: lỗi không cache (load lại sẽ thử lại)", async () => {
  const c = createPrefetchCache();
  let calls = 0;
  const bad = async (): Promise<PageProps> => { calls++; throw new Error("boom"); };
  await assert.rejects(c.load("/e", bad));
  await assert.rejects(c.load("/e", bad));
  assert.equal(calls, 2);
  assert.equal(c.has("/e"), false);
});

test("prefetch cache: clear", async () => {
  const c = createPrefetchCache();
  await c.load("/a", async () => ({ cell: "a", data: 1 }));
  await c.load("/b", async () => ({ cell: "b", data: 2 }));
  c.clear("/a");
  assert.equal(c.has("/a"), false);
  assert.equal(c.has("/b"), true);
  c.clear();
  assert.equal(c.size(), 0);
});
