import { readFileSync } from "node:fs";
import { makeServer } from "./server_factory";
import type { ResolutionManifest } from "./core/resolver";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const PORT = Number(process.env.PORT) || 5180;
makeServer(manifest).listen(PORT, () =>
  console.log(`fluxe @ http://localhost:${PORT} (profile: ${manifest.profile}, backend: ${manifest.backend.language})`));
