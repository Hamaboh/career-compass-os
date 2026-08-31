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
import { requestVersionInput } from "../../../../../../../lib/ai-safety/schemas";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId: id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    assertUlAiMutation(principal);
    const input = await strictJson(req, requestVersionInput);
    return success(
      await aiRepository(runtime).approveAndRun(
        principal,
        id,
        input.version,
        requestId,
      ),
      requestId,
    );
  });
}
