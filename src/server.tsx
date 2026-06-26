import { readFileSync } from "node:fs";
import { makeServer } from "./server_factory";
import type { ResolutionManifest } from "./core/resolver";
import { env } from "../app/env";   // validate env fail-fast lúc boot

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
makeServer(manifest).listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (profile: ${manifest.profile}, backend: ${manifest.backend.language}, env: ${env.NODE_ENV})`));
