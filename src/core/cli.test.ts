import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, renderUsage } from "./cli.ts";

test("có đủ lệnh cốt lõi", () => {
  for (const c of ["resolve", "prerender", "build", "dev", "test"]) {
    assert.ok(COMMANDS[c], `thiếu lệnh ${c}`);
  }
});

test("renderUsage liệt kê lệnh", () => {
  const u = renderUsage();
  assert.match(u, /fx resolve/);
  assert.match(u, /fx test/);
});

test("resolve dùng profile mặc định dev, override được", () => {
  assert.match(COMMANDS.resolve.shell([]), /scripts\/resolve\.ts dev/);
  assert.match(COMMANDS.resolve.shell(["prod-go"]), /prod-go/);
});

test("build gồm resolve + prerender + bundle", () => {
  const s = COMMANDS.build.shell([]);
  assert.match(s, /resolve\.ts/);
  assert.match(s, /prerender\.ts/);
  assert.match(s, /esbuild/);
});
