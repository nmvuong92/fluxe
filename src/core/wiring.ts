import type { Backend } from "../backends/types";
import type { ResolutionManifest, BackendResolution } from "./resolver.ts";
import { createMemoryBackend } from "../backends/memory.ts";
import { createHttpBackend } from "../backends/http.ts";

function buildBackend(b: BackendResolution): Backend {
  if (b.language === "memory") return createMemoryBackend();
  if (!b.endpoint) throw new Error(`manifest backend "${b.language}" thiếu endpoint`);
  return createHttpBackend(b.language, b.endpoint);
}

// Backend app-level (default) — giữ cho code cũ/đơn giản.
export function backendFromManifest(m: ResolutionManifest): Backend {
  return buildBackend(m.backend);
}

export interface ManifestBackends {
  byCell: Map<string, Backend>;
  default: Backend;
}

// Dựng backend per-cell, DEDUP theo key `language:endpoint` → cells cùng resolution
// chia sẻ MỘT instance (vd memory dùng chung một store).
export function backendsFromManifest(m: ResolutionManifest): ManifestBackends {
  const cache = new Map<string, Backend>();
  const make = (b: BackendResolution): Backend => {
    const key = `${b.language}:${b.endpoint ?? ""}`;
    let inst = cache.get(key);
    if (!inst) {
      inst = buildBackend(b);
      cache.set(key, inst);
    }
    return inst;
  };

  const def = make(m.backend);
  const byCell = new Map<string, Backend>();
  for (const id of Object.keys(m.cells)) {
    byCell.set(id, make(m.cells[id].backend));
  }
  return { byCell, default: def };
}
