// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Backend } from "../backends/types";
import type { ResolutionManifest, BackendResolution } from "./resolver.ts";
import { createMemoryBackend } from "../backends/memory.ts";
import { createSqliteBackend } from "../backends/sqlite.ts";

// Driver TS in-process, engine dựng được zero-dep. (postgres cần client `pg` → user tự inject,
// không phải kind auto-resolve.)
function buildBackend(b: BackendResolution): Backend {
  if (b.language === "memory") return createMemoryBackend();
  if (b.language === "sqlite") return createSqliteBackend(process.env.FLUXE_SQLITE_PATH ?? ":memory:");
  throw new Error(`manifest backend "${b.language}" không dựng được tự động (chỉ memory | sqlite)`);
}

// Backend app-level (default) — giữ cho code cũ/đơn giản.
export function backendFromManifest(m: ResolutionManifest): Backend {
  return buildBackend(m.backend);
}

export interface ManifestBackends {
  byCell: Map<string, Backend>;
  default: Backend;
}

// Dựng backend per-cell, DEDUP theo `language` → cells cùng resolution
// chia sẻ MỘT instance (vd memory dùng chung một store).
export function backendsFromManifest(m: ResolutionManifest): ManifestBackends {
  const cache = new Map<string, Backend>();
  const make = (b: BackendResolution): Backend => {
    const key = b.language;
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
