// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { f } from "../core/contract.ts";
import { openApiHandler } from "./serve.ts";

const contract = f.contract({ ping: f.query(f.string) });

async function serve() {
  const h = openApiHandler(contract, { title: "T", version: "9.9.9" });
  const server = http.createServer((req, res) => h(req, res, () => { res.writeHead(404); res.end("nf"); }));
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("GET /openapi.json → OpenAPI 3.1 JSON", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/openapi.json`);
    const doc = await res.json();
    assert.equal(res.status, 200);
    assert.equal(doc.openapi, "3.1.0");
    assert.equal(doc.info.version, "9.9.9");
  } finally { await close(); }
});

test("GET /docs → HTML Swagger UI", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/docs`);
    const html = await res.text();
    assert.match(res.headers.get("content-type") ?? "", /html/);
    assert.match(html, /swagger/i);
  } finally { await close(); }
});

test("path khác → gọi next() (fluxe/host lo tiếp)", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/other`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "nf");
  } finally { await close(); }
});
