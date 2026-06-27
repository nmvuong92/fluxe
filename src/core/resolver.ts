// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export type RenderMode = "static" | "island";
// Backend = driver data THUẦN TS, luôn in-process (không polyglot/sidecar).
export type BackendKind = "memory" | "sqlite" | "postgres";

export interface CellDecl {
  id: string;
  route: string;
  hydration?: RenderMode;   // MẶC ĐỊNH "island" (interactive). Static = opt-in tối ưu.
}

export interface ResolutionProfile {
  name: string;
  backend: BackendKind;                          // default app-level
  cellBackends?: Record<string, BackendKind>;    // override theo cell
}

export interface BackendResolution {
  language: BackendKind;   // driver TS in-process
}

export interface CellResolution {
  id: string;
  route: string;
  render: { mode: RenderMode; shipClientJs: boolean };
  backend: BackendResolution;                    // backend riêng của cell
}

export interface ResolutionManifest {
  version: 1;
  profile: string;
  backend: BackendResolution;
  cells: Record<string, CellResolution>;
}

const ALLOWED: BackendKind[] = ["memory", "sqlite", "postgres"];

// Giải một BackendKind → BackendResolution. Mọi driver TS đều in-process (0 roundtrip).
// Dùng chung cho default app-level lẫn override per-cell.
function resolveBackend(kind: BackendKind, profile: ResolutionProfile): BackendResolution {
  if (!ALLOWED.includes(kind)) {
    throw new Error(`profile "${profile.name}": backend không hợp lệ: ${kind}`);
  }
  return { language: kind };
}

export function resolve(cells: CellDecl[], profile: ResolutionProfile): ResolutionManifest {
  const ids = new Set(cells.map((c) => c.id));
  for (const id of Object.keys(profile.cellBackends ?? {})) {
    if (!ids.has(id)) {
      throw new Error(`profile "${profile.name}": cellBackends trỏ cell không tồn tại: ${id}`);
    }
  }

  const backend = resolveBackend(profile.backend, profile); // default app-level

  const out: Record<string, CellResolution> = {};
  const seenRoutes = new Set<string>();
  for (const c of cells) {
    if (out[c.id]) throw new Error(`cell id trùng: ${c.id}`);
    if (seenRoutes.has(c.route)) throw new Error(`route trùng: ${c.route}`);
    seenRoutes.add(c.route);
    const kind = profile.cellBackends?.[c.id] ?? profile.backend;
    const mode: RenderMode = c.hydration ?? "island";   // default island
    out[c.id] = {
      id: c.id,
      route: c.route,
      render: { mode, shipClientJs: mode === "island" },
      backend: resolveBackend(kind, profile),
    };
  }

  return { version: 1, profile: profile.name, backend, cells: out };
}
