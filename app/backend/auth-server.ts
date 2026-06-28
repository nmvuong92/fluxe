// AUTH PROVIDER (host-owned) — better-auth: email+password + role. fluxe KHÔNG đụng vào đây;
// nó chỉ bridge session qua app/auth.ts. Bảng do better-auth quản (better-sqlite3, file riêng).
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database(process.env.BIDLY_AUTH_DB || "bidly-auth.db"),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5180",
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-bidly-change-me-32+chars-long!",
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // role gắn vào user → map sang AppSession.roles ở bridgeSession.
      role: { type: "string", required: false, defaultValue: "bidder", input: true },
    },
  },
});

export type Auth = typeof auth;
