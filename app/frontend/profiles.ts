// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { ResolutionProfile } from "@nmvuong92/fluxe";

// Profile chỉ resolve RENDER (static/island). Data = app/backend (DI), không ở đây.
export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev" },
  prod: { name: "prod" },
};
