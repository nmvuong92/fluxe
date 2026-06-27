// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Theme — light/dark/auto qua data-theme trên <html> + localStorage. SSR-safe (window chỉ
 * đụng trong effect/handler). "auto" = theo OS (prefers-color-scheme) → static cell 0 JS vẫn
 * dark được nhờ CSS @media, không cần script. */
import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "auto";

function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  const t = localStorage.getItem("theme");
  return t === "light" || t === "dark" ? t : "auto";
}

function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "auto") el.removeAttribute("data-theme");
  else el.dataset.theme = t;
}

export function useTheme() {
  const [theme, set] = useState<Theme>("auto");
  useEffect(() => { const t = readTheme(); set(t); applyTheme(t); }, []);

  const setTheme = useCallback((t: Theme) => {
    set(t);
    if (typeof localStorage !== "undefined") localStorage.setItem("theme", t);
    applyTheme(t);
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return { theme, setTheme, toggle };
}
