// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMultipart, boundaryFromContentType } from "./multipart.ts";

function build(boundary: string, parts: Array<{ headers: string; body: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n${p.headers}\r\n\r\n`));
    chunks.push(typeof p.body === "string" ? Buffer.from(p.body) : p.body);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

test("boundaryFromContentType: lấy boundary (có/không quote)", () => {
  assert.equal(boundaryFromContentType("multipart/form-data; boundary=abc123"), "abc123");
  assert.equal(boundaryFromContentType('multipart/form-data; boundary="x y"'), "x y");
  assert.equal(boundaryFromContentType("application/json"), null);
});

test("parse: 1 file + 1 field text", () => {
  const b = "BOUND";
  const fileBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]); // bytes nhị phân
  const body = build(b, [
    { headers: `Content-Disposition: form-data; name="title"`, body: "Ảnh của tôi" },
    { headers: `Content-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png`, body: fileBytes },
  ]);
  const parts = parseMultipart(body, b);
  assert.equal(parts.length, 2);

  const title = parts.find((p) => p.name === "title")!;
  assert.equal(title.filename, undefined);
  assert.equal(title.data.toString("utf8"), "Ảnh của tôi");

  const file = parts.find((p) => p.name === "file")!;
  assert.equal(file.filename, "a.png");
  assert.equal(file.contentType, "image/png");
  assert.deepEqual(file.data, fileBytes);           // byte-exact (không hỏng binary)
});

test("parse: nhiều file cùng field name", () => {
  const b = "X";
  const body = build(b, [
    { headers: `Content-Disposition: form-data; name="f"; filename="1.txt"`, body: "one" },
    { headers: `Content-Disposition: form-data; name="f"; filename="2.txt"`, body: "two" },
  ]);
  const parts = parseMultipart(body, b);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((p) => p.data.toString()), ["one", "two"]);
  assert.deepEqual(parts.map((p) => p.filename), ["1.txt", "2.txt"]);
});

test("parse: body có chứa chuỗi giống \\r\\n không làm hỏng (data byte-exact)", () => {
  const b = "B";
  const tricky = Buffer.from("line1\r\nline2\r\n--notboundary");
  const body = build(b, [{ headers: `Content-Disposition: form-data; name="x"; filename="m.txt"`, body: tricky }]);
  const parts = parseMultipart(body, b);
  assert.equal(parts.length, 1);
  assert.deepEqual(parts[0].data, tricky);
});

test("parse: rỗng / không part → []", () => {
  assert.deepEqual(parseMultipart(Buffer.from("--B--\r\n"), "B"), []);
});
