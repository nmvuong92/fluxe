---
title: Codegen
description: genTS/genGo/genRust contract codegen — một schema → 3 ngôn ngữ.
sidebar:
  order: 71
---

## Định nghĩa

**Contract codegen polyglot**: một `Schema` duy nhất sinh ra type cho **TS + Go + Rust** → type-safe
xuyên ngôn ngữ (chữ ký RCA — backend Go/Rust và frontend TS dùng chung định nghĩa dữ liệu). Đổi field
một chỗ (`app/contract.ts`) → cả 3 ngôn ngữ đồng bộ.

Các generator `genTS`/`genGo`/`genRust` là **thuần (string-in/string-out)** → dễ test, không cần chạy
compiler. `fx gen` lấy `contract` từ `app/contract.ts`, chạy cả 3 generator và ghi kết quả ra
`.fluxe/gen/` (kèm banner "đừng sửa tay").

## Cơ chế trong fluxe

- **`Schema`** mô tả các type qua `types: Record<string, Record<string, FieldType>>`, với `FieldType`
  là `"string" | "bool" | "int"`. Mỗi generator có một bảng map riêng: TS dùng `string/boolean/number`,
  Go dùng `string/bool/int`, Rust dùng `String/bool/i64`.
- **`genTS(s)`** sinh `export interface`; **`genGo(s, pkg?)`** sinh `type … struct` với field
  PascalCase + tag `json:"<field gốc>"` (pkg mặc định `"contract"`); **`genRust(s)`** sinh
  `#[derive(Clone, Debug)] pub struct`. Cả ba nhận cùng một `Schema` nên đổi field một chỗ là đồng bộ
  cả 3 ngôn ngữ.

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

`fx gen` (hoặc `tsx scripts/codegen.ts`) → sinh 3 ngôn ngữ:

```ts
// .fluxe/gen/types.ts
export interface Todo {
  id: string;
  title: string;
  done: boolean;
}
```

```go
// .fluxe/gen/contract.go
package contract

type Todo struct {
	Id string `json:"id"`
	Title string `json:"title"`
	Done bool `json:"done"`
}
```

(generator dùng một tab giữa field/kiểu — `gofmt` sẽ căn cột lại.)

```rust
// .fluxe/gen/contract.rs
#[derive(Clone, Debug)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub done: bool,
}
```

## API

```ts
// @nmvuong92/fluxe
type FieldType = "string" | "bool" | "int"
interface Schema { types: Record<string, Record<string, FieldType>> }

genTS(s: Schema): string
genGo(s: Schema, pkg?: string): string     // pkg mặc định "contract"
genRust(s: Schema): string
```

## Lưu ý

- `FieldType` chỉ hỗ trợ `string | bool | int` — map: TS `string/boolean/number`, Go `string/bool/int`,
  Rust `String/bool/i64`. Thêm kiểu mới phải bổ sung cả 3 bảng `TS`/`GO`/`RS`.
- Go field được **PascalCase** (`id` → `Id`) cho exported + giữ `json:"id"` để serialize đúng key gốc.
- Output có banner "đừng sửa tay" — `.fluxe/gen/` là sinh tự động, sửa contract ở `app/contract.ts`.
- Generator thuần → có thể unit-test bằng so chuỗi (so 1 schema → 3 output) mà không cần go/rustc.
