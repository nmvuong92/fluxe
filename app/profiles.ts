import type { ResolutionProfile } from "../src/core/resolver";

export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev", backend: "memory" },
  // SQLite (node:sqlite, in-process). Path qua FLUXE_SQLITE_PATH (mặc định :memory:).
  sqlite: { name: "sqlite", backend: "sqlite" },
  // Per-cell: app default = memory, riêng cell `todos` giải sang sqlite (đối chứng resolve per-cell).
  mixed: { name: "mixed", backend: "memory", cellBackends: { todos: "sqlite" } },
};
