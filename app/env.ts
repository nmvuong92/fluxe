import { z } from "zod";
import { loadEnv } from "../src/core/env";

/* Env của APP — dev khai báo ở đây. Validate fail-fast lúc boot (thiếu/sai → chặn ngay). */
export const env = loadEnv(
  z.object({
    PORT: z.coerce.number().int().positive().default(5180),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    FLUXE_SECRET: z.string().min(8).default("dev-secret-change-me"),
  }),
);
