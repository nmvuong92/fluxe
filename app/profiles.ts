import type { ResolutionProfile } from "../src/core/resolver";

// Profile chỉ resolve RENDER (static/island). Data = app/backend.ts (DI), không ở đây.
export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev" },
  prod: { name: "prod" },
};
