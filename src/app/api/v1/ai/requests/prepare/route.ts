import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import {
  aiRepository,
  assertUlAiMutation,
} from "../../../../../../lib/ai-safety/http";
import { prepareInput } from "../../../../../../lib/ai-safety/schemas";

export async function POST(req: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    assertUlAiMutation(principal);
    const input = await strictJson(req, prepareInput);
    return success(
      await aiRepository(runtime).prepare(principal, input, requestId),
      requestId,
      null,
      201,
    );
  });
}
