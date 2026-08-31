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
import { previewEditInput } from "../../../../../../../lib/ai-safety/schemas";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId: id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertUlAiMutation(principal);
    return success(
      await aiRepository(runtime).preview(principal, id),
      requestId,
    );
  });
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId: id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    assertUlAiMutation(principal);
    const input = await strictJson(req, previewEditInput);
    return success(
      await aiRepository(runtime).editPreview(
        principal,
        id,
        input.version,
        input.sanitizedText,
        requestId,
      ),
      requestId,
    );
  });
}
