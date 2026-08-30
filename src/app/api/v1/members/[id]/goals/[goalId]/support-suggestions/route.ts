import { memberRuntime } from "../../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../../lib/member/schemas";
import { supportWrite } from "../../../../../../../../lib/continuous-support/http";
import { suggestionInput } from "../../../../../../../../lib/continuous-support/schemas";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> },
) {
  const { id, goalId } = await params;
  idSchema.parse(id);
  idSchema.parse(goalId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    const input = await strictJson(req, suggestionInput);
    const repository = await supportWrite(
      runtime.db,
      principal,
      id,
      requestId,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repository.createSuggestions(
        principal,
        id,
        goalId,
        input.version,
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
