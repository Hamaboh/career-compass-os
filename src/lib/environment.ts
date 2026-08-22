import { z } from "zod";

export const environmentSchema = z.object({
  APP_ENV: z.enum(["local", "ci", "preview", "production"]),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;
export function parseEnvironment(input: unknown): AppEnvironment {
  return environmentSchema.parse(input);
}
