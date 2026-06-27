// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* <ThemeToggle/> — nút đổi light/dark. Render HTML thuần + marker; logic do shellScript (vanilla)
 * xử lý → chạy cả trên trang static (0 React JS). Không cần hydrate. */
export function ThemeToggle() {
  return (
    <button data-fluxe-theme-toggle className="theme-toggle" aria-label="Đổi giao diện sáng/tối" title="Sáng/Tối">
      ◐
    </button>
  );
}
