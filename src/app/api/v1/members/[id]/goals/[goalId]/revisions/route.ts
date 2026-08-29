import { memberRuntime } from "../../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../../lib/member/schemas";
import { revisionInput } from "../../../../../../../../lib/goal/schemas";
import { goalWrite } from "../../../../../../../../lib/goal/http";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; goalId: string }> },
) {
  const { id, goalId } = await params;
  idSchema.parse(id);
  idSchema.parse(goalId);
  const rt = await memberRuntime();
  return withMemberRuntime(req, rt, async (_, p, rid) => {
    assertMutationRequest(req);
    const repo = await goalWrite(
      rt.db,
      p,
      id,
      rid,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repo.revise(
        p,
        id,
        goalId,
        await strictJson(req, revisionInput),
        rid,
      ),
      rid,
      null,
      201,
    );
  });
}
