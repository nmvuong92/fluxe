// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export type RenderMode = "static" | "island";

export interface CellDecl {
  id: string;
  route: string;
  hydration?: RenderMode;   // MẶC ĐỊNH "island" (interactive). Static = opt-in tối ưu.
}

// Profile chỉ điều khiển RENDER (RCA sau khi bỏ polyglot). Data = user-owned (app/backend.ts),
// inject qua makeServer({ backend }) — KHÔNG resolve qua manifest.
export interface ResolutionProfile {
  name: string;
}

export interface CellResolution {
  id: string;
  route: string;
  render: { mode: RenderMode; shipClientJs: boolean };
}

export interface ResolutionManifest {
  version: 1;
  profile: string;
  cells: Record<string, CellResolution>;
}

export function resolve(cells: CellDecl[], profile: ResolutionProfile): ResolutionManifest {
  const out: Record<string, CellResolution> = {};
  const seenRoutes = new Set<string>();
  for (const c of cells) {
    if (out[c.id]) throw new Error(`cell id trùng: ${c.id}`);
    if (seenRoutes.has(c.route)) throw new Error(`route trùng: ${c.route}`);
    seenRoutes.add(c.route);
    const mode: RenderMode = c.hydration ?? "island";   // default island
    out[c.id] = {
      id: c.id,
      route: c.route,
      render: { mode, shipClientJs: mode === "island" },
    };
  }

  return { version: 1, profile: profile.name, cells: out };
}
