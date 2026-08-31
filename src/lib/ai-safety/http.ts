import type { Principal } from "../auth/types";
import type { MemberRuntime } from "../member/http";
import { MemberError } from "../member/errors";
import { AiSafetyRepository } from "./repository";

export function aiRepository(runtime: MemberRuntime) {
  if (!runtime.privateFiles)
    throw new MemberError(
      "AI_UNAVAILABLE",
      503,
      "private_context_store_unavailable",
    );
  return new AiSafetyRepository(runtime.db, runtime.privateFiles);
}

export function assertUlAiMutation(principal: Principal) {
  if (
    !principal.roles.includes("UL") ||
    !principal.capabilities.includes("UNIT_EDIT_SCOPED") ||
    principal.globalUnitRead
  )
    throw new MemberError(
      "RESOURCE_NOT_FOUND",
      404,
      "ai_mutation_not_available",
    );
}
