import type { ZodType } from "zod";

/* Config/env có kiểu (4k) — validate process.env theo schema, FAIL-FAST lúc boot
 * (thiếu/sai biến → chặn ngay, không chết giữa prod). Coerce string→number/bool qua Zod. */
export function loadEnv<T>(schema: ZodType<T>, source: Record<string, string | undefined> = process.env): T {
  const r = schema.safeParse(source);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
    throw new Error(`Cấu hình env không hợp lệ (fail-fast lúc boot):\n${issues}`);
  }
  return r.data;
}
