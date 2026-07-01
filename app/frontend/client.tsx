// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Client entry (project-owned) — bundle bởi `fx build`. Chỉ import view (không server code). */
import { hydrate } from "@nmvuong92/fluxe/react";
import { views } from "./views";
import { layouts } from "./layouts/index";

hydrate(views, layouts);
