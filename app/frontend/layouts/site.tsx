// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { LocaleSwitch, DebugBar } from "@nmvuong92/fluxe/react";
export function Site({ children, ctx }: { children: ReactNode; ctx?: any }) {
  return (
    <>
      <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
          <strong>fluxe</strong>
          <LocaleSwitch locales={["vi", "en"]} current={ctx?.locale} />
        </header>
        {children}
      </main>
      <DebugBar />
    </>
  );
}
export default Site;
