import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SHADOW_DATABASE_URL: z.string().url().startsWith("postgresql://").optional(),
  TEST_DATABASE_URL: z.string().url().startsWith("postgresql://").optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  CLIENT_URL: z.string().min(1),
  BUSINESS_TIME_ZONE: z.string().default("Africa/Addis_Ababa"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_MAX_ROWS: z.coerce.number().int().positive().max(100_000).default(10_000),
  ADMIN_NAME: z.string().min(2).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}

export const env = parsed.data;

const baseOrigins = env.CLIENT_URL.split(",").map((origin) => origin.trim()).filter(Boolean);
const derivedOrigins = new Set<string>();

for (const origin of baseOrigins) {
  derivedOrigins.add(origin);
  try {
    const url = new URL(origin);
    if (url.hostname.startsWith("www.")) {
      const nonWwwHostname = url.hostname.substring(4);
      const nonWwwOrigin = `${url.protocol}//${nonWwwHostname}${url.port ? `:${url.port}` : ""}`;
      derivedOrigins.add(nonWwwOrigin);
    } else {
      const wwwOrigin = `${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ""}`;
      derivedOrigins.add(wwwOrigin);
    }
  } catch {
    // Ignore invalid URLs in CLIENT_URL
  }
}

export const allowedOrigins = Array.from(derivedOrigins);

