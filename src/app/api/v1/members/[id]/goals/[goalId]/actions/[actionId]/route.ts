import { memberRuntime } from "../../../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../../../lib/member/schemas";
import { actionStatusInput } from "../../../../../../../../../lib/goal/schemas";
import { goalWrite } from "../../../../../../../../../lib/goal/http";

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; goalId: string; actionId: string }> },
) {
  const { id, goalId, actionId } = await params;
  idSchema.parse(id);
  idSchema.parse(goalId);
  idSchema.parse(actionId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    const repository = await goalWrite(
      runtime.db,
      principal,
      id,
      requestId,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repository.updateAction(
        principal,
        id,
        goalId,
        actionId,
        await strictJson(req, actionStatusInput),
        requestId,
      ),
      requestId,
    );
  });
}
