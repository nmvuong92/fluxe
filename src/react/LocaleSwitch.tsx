// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* <LocaleSwitch> — đổi ngôn ngữ qua link ?locale=xx (server set cookie + redirect).
 * Render HTML thuần → chạy cả trên cell static (0 JS). Active theo `current` (ctx.locale). */
export function LocaleSwitch({
  locales,
  current,
  labels,
  className,
}: {
  locales: string[];
  current?: string;
  labels?: Record<string, string>;
  className?: string;
}) {
  return (
    <span className={className ?? "locale-switch"}>
      {locales.map((l) => (
        <a
          key={l}
          href={`?locale=${l}`}
          className={l === current ? "locale active" : "locale"}
          aria-current={l === current ? "true" : undefined}
        >
          {labels?.[l] ?? l.toUpperCase()}
        </a>
      ))}
    </span>
  );
}
