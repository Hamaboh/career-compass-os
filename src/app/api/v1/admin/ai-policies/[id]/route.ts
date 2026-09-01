import { adminRepository } from "../../../../../../lib/admin/http";
import { aiPolicyInput } from "../../../../../../lib/admin/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      const { id } = await context.params;
      return success(
        await adminRepository(
          runtime,
          principal,
          "AI_CONFIG_MANAGE",
        ).updateAiPolicy(
          principal,
          id,
          await strictJson(request, aiPolicyInput),
          requestId,
        ),
        requestId,
      );
    },
  );
}
