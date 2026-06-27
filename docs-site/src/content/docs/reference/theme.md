---
title: Theme
description: Theme light/dark/auto (no-flash), ThemeToggle, useTheme, shellScript — chạy cả trên cell static.
sidebar:
  order: 51
---

## Định nghĩa

fluxe hỗ trợ **theme light/dark/auto** qua attribute `data-theme` trên `<html>` + `localStorage`.
`auto` = theo OS (`prefers-color-scheme`); `[data-theme]` ép light/dark.

Điểm cốt lõi: **theme toggle + nav active chạy cả trên trang static (0 React JS)** nhờ
`shellScript` — một đoạn JS vanilla ~0.5KB nhúng trong layout, độc lập React. Trang static không
hydrate vẫn đổi được theme và highlight nav, vì logic nằm ở shellScript chứ không phải React. Cell
island cần đổi theme bằng React thì dùng hook `useTheme()`.

## Cơ chế trong fluxe

- **`shellScript`** là một đoạn JS vanilla (~0.5KB) bạn nhúng vào layout, chạy trên MỌI trang (kể cả
  static 0 React JS). Nó làm 3 việc: **No-flash** — đọc `localStorage.theme` set `data-theme` ngay
  khi parse (trước content) nên không nháy sáng→tối; **Toggle** — wire nút
  `[data-fluxe-theme-toggle]` để đổi light/dark + lưu localStorage; **Active** — set `.nav-link.active`
  theo path, cập nhật khi SPA nav (`fluxe:nav`) + `popstate`.
- **`<ThemeToggle>`** chỉ render một `<button>` mang marker `data-fluxe-theme-toggle`; logic đổi
  theme do `shellScript` xử lý (không tự chứa logic).
- **`useTheme()`** là hook React cho island cell cần đọc/đổi theme bằng state. Nó SSR-safe
  (`window`/`localStorage` chỉ đụng trong effect/handler) và ghi cùng `localStorage.theme` +
  `data-theme` như `shellScript`. `auto` gỡ `data-theme` để CSS `@media (prefers-color-scheme)` quyết.

## Ví dụ

Nhúng `shellScript` + `<ThemeToggle>` trong layout (chạy cả static), import từ `@nmvuong92/fluxe/react`:

```tsx
import { ThemeToggle, shellScript } from "@nmvuong92/fluxe/react";
// trong layout:
<script>{shellScript}</script>
<ThemeToggle/>
```

Island cell đổi theme bằng React:

```tsx
import { useTheme } from "@nmvuong92/fluxe/react";
function Settings() {
  const { theme, setTheme, toggle } = useTheme();
  return <button onClick={toggle}>Theme: {theme}</button>;
}
```

:::note[Static-first]
Theme toggle + nav active chạy trên trang **static 0 React JS** nhờ vanilla `shellScript` (không
phải React hydrate). Trang island vẫn có thêm SPA nav qua [`<Link>`](/reference/navigation/).
:::

## API

```ts
// @nmvuong92/fluxe/react
type Theme = "light" | "dark" | "auto"
useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }

<ThemeToggle/>            // <button data-fluxe-theme-toggle> — logic do shellScript

shellScript: string      // vanilla ~0.5KB: no-flash + toggle + nav active
```

## Lưu ý

- `auto` **không** set `data-theme` (removeAttribute) → để CSS `@media (prefers-color-scheme)` quyết.
  Nhờ vậy static cell 0 JS vẫn dark được theo OS mà không cần script.
- `<ThemeToggle>` chỉ là nút có marker `data-fluxe-theme-toggle`; **không tự chứa logic** — phải có
  `shellScript` (hoặc `useTheme`) trên trang thì nút mới hoạt động.
- shellScript guard `b._w` để không wire trùng listener khi SPA nav re-render.
- `useTheme` và shellScript đọc/ghi cùng `localStorage.theme` + `data-theme` → đồng bộ với nhau.
