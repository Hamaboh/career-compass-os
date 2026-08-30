import { memberRuntime } from "../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../lib/member/schemas";
import { supportWrite } from "../../../../../../../lib/continuous-support/http";
import { oneOnOneUpdateInput } from "../../../../../../../lib/continuous-support/schemas";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; oneOnOneId: string }> },
) {
  const { id, oneOnOneId } = await params;
  idSchema.parse(id);
  idSchema.parse(oneOnOneId);
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
      await repository.updateOneOnOne(
        principal,
        id,
        oneOnOneId,
        await strictJson(req, oneOnOneUpdateInput),
        requestId,
      ),
      requestId,
    );
  });
}
