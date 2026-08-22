import {
  idSchema,
  statusHistorySchema,
} from "../../../../../../lib/member/schemas";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../lib/member/route-runtime";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) => {
    assertMutationRequest(request);
    const id = idSchema.parse((await params).id);
    const body = await strictJson(request, statusHistorySchema);
    return success(
      await s.statusHistory(
        p,
        id,
        body,
        r,
        request.headers.get("x-maintenance-reason") ?? undefined,
      ),
      r,
      null,
      201,
    );
  });
}
