import { z } from "zod";

export const environmentSchema = z.object({
  APP_ENV: z.enum(["local", "ci", "preview", "production"]),
  AUTH_MODE: z.enum(["fake", "cloudflare-access"]),
  ACCESS_ISSUER: z.string().min(1),
  ACCESS_AUDIENCE: z.string().min(1),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;
export function parseEnvironment(input: unknown): AppEnvironment {
  return environmentSchema.parse(input);
}
