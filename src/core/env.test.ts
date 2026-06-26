import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { loadEnv } from "./env.ts";

test("env hợp lệ → object có kiểu (coerce string→number)", () => {
  const env = loadEnv(z.object({ PORT: z.coerce.number(), SECRET: z.string().min(1) }), { PORT: "5180", SECRET: "x" });
  assert.equal(env.PORT, 5180);
  assert.equal(env.SECRET, "x");
});

test("default khi thiếu", () => {
  const env = loadEnv(z.object({ PORT: z.coerce.number().default(3000) }), {});
  assert.equal(env.PORT, 3000);
});

test("thiếu var bắt buộc → throw fail-fast nêu tên var", () => {
  assert.throws(() => loadEnv(z.object({ SECRET: z.string().min(1) }), {}), /SECRET/);
});

test("sai kiểu → throw", () => {
  assert.throws(() => loadEnv(z.object({ PORT: z.coerce.number() }), { PORT: "abc" }));
});
