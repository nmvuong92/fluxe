// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "./server_factory.ts";
import { resolve } from "./core/resolver.ts";
import { createBroker } from "./core/broker.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("[inject] opts.broker: host-injected broker LÀ broker fluxe dùng cho /__sse", async () => {
  const broker = createBroker();
  const m = resolve([], { name: "t" });
  const srv = makeServer(m, [], {}, { broker }).listen(0);
  await new Promise<void>((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;

  // Mở 1 kết nối SSE tới topic "room" → server subscribe response vào broker ĐƯỢC TIÊM.
  const req = http.get(`http://127.0.0.1:${port}/__sse/room`, () => {});
  try {
    await delay(150);
    // Nếu server dùng đúng broker host tiêm → có 1 subscriber trên "room".
    assert.equal(broker.count("room"), 1, "broker host tiêm phải có subscriber từ /__sse");
  } finally {
    req.destroy();
    srv.close();
  }
});
