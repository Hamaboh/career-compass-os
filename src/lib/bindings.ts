import { parseEnvironment, type AppEnvironment } from "./environment";

export interface AccessBinding {
  verify(token: string): Promise<{ subject: string } | null>;
}
export interface AiBinding {
  propose(input: string): Promise<{ output: string }>;
}

export interface AppBindings extends AppEnvironment {
  DB: Pick<D1Database, "prepare">;
  PRIVATE_FILES: Pick<R2Bucket, "get" | "put" | "delete">;
  ACCESS: AccessBinding;
  AI: AiBinding;
}

export function assertPlatformBindings(
  value: Partial<AppBindings>,
): asserts value is AppBindings {
  try {
    parseEnvironment(value);
  } catch {
    throw new Error("Required platform binding is unavailable or invalid");
  }
  if (!value.DB || !value.PRIVATE_FILES || !value.ACCESS || !value.AI)
    throw new Error("Required platform binding is unavailable");
}
