import { memberRuntime } from "../../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../../lib/member/schemas";
import { supportWrite } from "../../../../../../../../lib/continuous-support/http";
import { indicatorInput } from "../../../../../../../../lib/continuous-support/schemas";

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
    const repository = await supportWrite(
      runtime.db,
      principal,
      id,
      requestId,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repository.addIndicator(
        principal,
        id,
        goalId,
        await strictJson(req, indicatorInput),
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
