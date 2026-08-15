import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_ISSUER: z.string().url().optional(),
  SUPABASE_JWT_AUDIENCE: z.string().min(1).default("authenticated")
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: AppEnvironment | undefined;

export function environment(): AppEnvironment {
  cachedEnvironment ??= environmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
