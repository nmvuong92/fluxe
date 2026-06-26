export type RenderMode = "static" | "island";
export type BackendKind = "memory" | "go" | "rust";

export interface CellDecl {
  id: string;
  route: string;
  hydration: RenderMode;
}

export interface ResolutionProfile {
  name: string;
  backend: BackendKind;                          // default app-level
  endpoints?: { go?: string; rust?: string };
  cellBackends?: Record<string, BackendKind>;    // override theo cell
}

export interface BackendResolution {
  language: BackendKind;
  transport: "in-process" | "http";
  endpoint?: string;
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

const ALLOWED: BackendKind[] = ["memory", "go", "rust"];

// Giải một BackendKind → BackendResolution (validate endpoint nếu http). Dùng chung
// cho default app-level lẫn override per-cell.
function resolveBackend(kind: BackendKind, profile: ResolutionProfile): BackendResolution {
  if (!ALLOWED.includes(kind)) {
    throw new Error(`profile "${profile.name}": backend không hợp lệ: ${kind}`);
  }
  if (kind === "memory") return { language: "memory", transport: "in-process" };
  const endpoint = profile.endpoints?.[kind];
  if (!endpoint) {
    throw new Error(`profile "${profile.name}": backend "${kind}" cần endpoints.${kind}`);
  }
  return { language: kind, transport: "http", endpoint };
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
    out[c.id] = {
      id: c.id,
      route: c.route,
      render: { mode: c.hydration, shipClientJs: c.hydration === "island" },
      backend: resolveBackend(kind, profile),
    };
  }

  return { version: 1, profile: profile.name, backend, cells: out };
}
