import type { ResolutionProfile } from "./core/resolver";

export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev", backend: "memory" },
  "prod-go": { name: "prod-go", backend: "go", endpoints: { go: "http://127.0.0.1:8081" } },
  "prod-rust": { name: "prod-rust", backend: "rust", endpoints: { rust: "http://127.0.0.1:8082" } },
};
