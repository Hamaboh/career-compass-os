import { memberRuntime } from "../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../lib/member/schemas";
import {
  aiRepository,
  assertUlAiMutation,
} from "../../../../../../../lib/ai-safety/http";
import { suggestionDecisionInput } from "../../../../../../../lib/ai-safety/schemas";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ suggestionId: string }> },
) {
  const { suggestionId } = await params;
  idSchema.parse(suggestionId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    assertUlAiMutation(principal);
    const input = await strictJson(req, suggestionDecisionInput);
    return success(
      await aiRepository(runtime).decide(
        principal,
        suggestionId,
        input,
        requestId,
      ),
      requestId,
    );
  });
}
