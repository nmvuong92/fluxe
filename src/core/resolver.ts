export type RenderMode = "static" | "island";
export type BackendKind = "memory" | "go" | "rust";

export interface CellDecl {
  id: string;
  route: string;
  hydration: RenderMode;
}

export interface ResolutionProfile {
  name: string;
  backend: BackendKind;
  endpoints?: { go?: string; rust?: string };
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
}

export interface ResolutionManifest {
  version: 1;
  profile: string;
  backend: BackendResolution;
  cells: Record<string, CellResolution>;
}

const ALLOWED: BackendKind[] = ["memory", "go", "rust"];

export function resolve(cells: CellDecl[], profile: ResolutionProfile): ResolutionManifest {
  if (!ALLOWED.includes(profile.backend)) {
    throw new Error(`profile "${profile.name}": backend không hợp lệ: ${profile.backend}`);
  }

  let backend: BackendResolution;
  if (profile.backend === "memory") {
    backend = { language: "memory", transport: "in-process" };
  } else {
    const endpoint = profile.endpoints?.[profile.backend];
    if (!endpoint) {
      throw new Error(`profile "${profile.name}": backend "${profile.backend}" cần endpoints.${profile.backend}`);
    }
    backend = { language: profile.backend, transport: "http", endpoint };
  }

  const out: Record<string, CellResolution> = {};
  const seenRoutes = new Set<string>();
  for (const c of cells) {
    if (out[c.id]) throw new Error(`cell id trùng: ${c.id}`);
    if (seenRoutes.has(c.route)) throw new Error(`route trùng: ${c.route}`);
    seenRoutes.add(c.route);
    out[c.id] = {
      id: c.id,
      route: c.route,
      render: { mode: c.hydration, shipClientJs: c.hydration === "island" },
    };
  }

  return { version: 1, profile: profile.name, backend, cells: out };
}
