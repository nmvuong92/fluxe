---
title: Codegen
description: genTS contract codegen — một schema → types TS đồng bộ.
sidebar:
  order: 71
---

## Định nghĩa

**Contract codegen**: một `Schema` duy nhất sinh ra type TS → một nguồn sự thật cho định nghĩa
dữ liệu. Đổi field một chỗ (`app/contract.ts`) → type TS đồng bộ.

Generator `genTS` là **thuần (string-in/string-out)** → dễ test, không cần chạy compiler. `fx gen`
lấy `contract` từ `app/contract.ts`, chạy `genTS` và ghi kết quả ra `.fluxe/gen/types.ts`
(kèm banner "đừng sửa tay").

## Cơ chế trong fluxe

- **`Schema`** mô tả các type qua `types: Record<string, Record<string, FieldType>>`, với `FieldType`
  là `"string" | "bool" | "int"`. Generator map sang TS: `string/boolean/number`.
- **`genTS(s)`** sinh `export interface` cho mỗi type trong schema.

## Ví dụ

Schema thật trong `app/contract.ts` — nguồn sự thật DUY NHẤT:

```ts
// app/contract.ts
export const contract: Schema = {
  types: {
    Todo: { id: "string", title: "string", done: "bool" },
  },
};
```

`fx gen` → sinh types TS:

```ts
// .fluxe/gen/types.ts
export interface Todo {
  id: string;
  title: string;
  done: boolean;
}
```

## API

```ts
// @nmvuong92/fluxe
type FieldType = "string" | "bool" | "int"
interface Schema { types: Record<string, Record<string, FieldType>> }

genTS(s: Schema): string
```

## Lưu ý

- `FieldType` chỉ hỗ trợ `string | bool | int` — map sang TS `string/boolean/number`. Thêm kiểu
  mới phải bổ sung bảng map.
- Output có banner "đừng sửa tay" — `.fluxe/gen/` là sinh tự động, sửa contract ở `app/contract.ts`.
- Generator thuần → có thể unit-test bằng so chuỗi (so 1 schema → output) mà không cần compiler.
