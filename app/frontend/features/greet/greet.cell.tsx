// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Greet } from "./greet.view";

export default defineCell({
  id: "greet",
  route: "/greet",
  hydration: "static",   // static + i18n — chứng minh 0 JS mà vẫn đa ngôn ngữ
  layout: "site",
  async loader({ t }) {
    return { hello: t!("greet.hello", { name: "fluxe" }), desc: t!("greet.desc") };
  },
  head: () => ({ title: "Greet" }),
  view: Greet,
});
