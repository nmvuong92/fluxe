import type { Backend } from "../backends/types";
import type { ResolutionManifest } from "./resolver.ts";
import { createMemoryBackend } from "../backends/memory.ts";
import { createHttpBackend } from "../backends/http.ts";

export function backendFromManifest(m: ResolutionManifest): Backend {
  const b = m.backend;
  if (b.language === "memory") return createMemoryBackend();
  if (!b.endpoint) throw new Error(`manifest backend "${b.language}" thiếu endpoint`);
  return createHttpBackend(b.language, b.endpoint);
}
