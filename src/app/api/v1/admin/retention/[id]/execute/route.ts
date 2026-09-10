import { adminRepository } from "../../../../../../../lib/admin/http";
import { retentionExecuteInput } from "../../../../../../../lib/admin/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../lib/member/security";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      const { id } = await context.params;
      return success(
        await adminRepository(
          runtime,
          principal,
          "RETENTION_MANAGE",
        ).executeRetention(
          principal,
          id,
          await strictJson(request, retentionExecuteInput),
          requestId,
        ),
        requestId,
      );
    },
  );
}
