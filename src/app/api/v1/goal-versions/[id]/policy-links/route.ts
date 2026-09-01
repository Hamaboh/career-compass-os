import { policyRead } from "../../../../../../lib/executive/http";
import { goalPolicyLinkInput } from "../../../../../../lib/executive/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { idSchema } from "../../../../../../lib/member/schemas";
import { assertMutationRequest } from "../../../../../../lib/member/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      const input = await strictJson(request, goalPolicyLinkInput);
      return success(
        await policyRead(runtime.db, principal).linkGoalPolicy(
          principal,
          id,
          input.policyItemId,
          input.relevanceNote,
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
