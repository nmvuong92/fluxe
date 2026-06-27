---
title: Env
description: loadEnv fail-fast (Zod) — thiếu/sai env ném ngay lúc boot.
sidebar:
  order: 25
---

## Định nghĩa

**Config phải có kiểu và fail-fast.** `loadEnv` validate `process.env` theo một schema Zod **ngay
lúc boot**: thiếu biến bắt buộc hoặc sai kiểu thì **ném lập tức** — chặn app khởi động, thay vì chết
giữa production khi đụng tới biến hỏng. Zod còn **coerce** string → number/boolean (env luôn là
string) và áp default, nên phần còn lại của code nhận config đã có kiểu chuẩn.

Đây là hiện thực của Tenet T1: secret (session/CSRF) không hardcode mà nạp qua env có kiểm tra.

## Cơ chế trong fluxe

```ts
// @nmvuong92/fluxe
export function loadEnv<T>(schema: ZodType<T>, source: Record<string, string | undefined> = process.env): T {
  const r = schema.safeParse(source);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`).join("\n");
    throw new Error(`Cấu hình env không hợp lệ (fail-fast lúc boot):\n${issues}`);
  }
  return r.data;
}
```

`source` mặc định là `process.env` nhưng inject được (truyền object) → dễ test mà không đụng biến môi trường thật.

## Ví dụ

App khai báo env của mình một chỗ; `loadEnv` chạy lúc import module nên sai là chặn boot:

```ts
// app/env.ts
import { z } from "zod";
import { loadEnv } from "@nmvuong92/fluxe";

export const env = loadEnv(
  z.object({
    PORT: z.coerce.number().int().positive().default(5180),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_SECRET: z.string().min(8).default("dev-secret-change-me"),  // secret của app bạn (vd host auth)
  }),
);
```

- `z.coerce.number()` biến `PORT="3000"` (string) → `3000` (number).
- `.default(...)` cho biến thiếu → giá trị mặc định (vd `PORT` 5180).
- `APP_SECRET` bắt buộc `min(8)` → secret quá ngắn bị chặn ngay.

## API

```ts
// @nmvuong92/fluxe
loadEnv<T>(schema: ZodType<T>, source = process.env): T   // thiếu/sai env → ném ngay lúc boot
```

## Lưu ý

:::caution[Tenet T1]
HTTPS-only kể cả local; mọi secret của app (auth host, API key…) không hardcode — nạp qua `loadEnv`.
:::

- Default `"dev-secret-change-me"` chỉ tiện cho **dev**. Production **bắt buộc** đặt `APP_SECRET`
  thật (secret này là của app/host bạn — vd ký session ở host).
- Lỗi ném gộp **tất cả** biến hỏng cùng lúc (`issues.join`) → sửa một lần, không phải dò từng biến.
- Gọi `loadEnv` ở **top-level module** (như `app/env.ts`) để fail-fast thật sự — nếu hoãn tới khi
  dùng thì mất ý nghĩa boot-time.
