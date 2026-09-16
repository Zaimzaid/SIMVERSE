import { z } from "zod";

/**
 * Validated server-side environment configuration.
 *
 * This module is server-only: it reads secrets (SESSION_SECRET, DATABASE_URL)
 * and must never be imported from client components. Validation runs once at
 * import time and fails fast with a readable message if configuration is bad.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("SIMVERSE"),
  APP_URL: z.url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCheck your .env file against .env.example.`,
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
