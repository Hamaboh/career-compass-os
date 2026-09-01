import { adminRepository } from "../../../../../lib/admin/http";
import { quotaInput } from "../../../../../lib/admin/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function POST(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      return success(
        await adminRepository(
          runtime,
          principal,
          "OPERATIONS_READ",
        ).recordQuota(
          principal,
          await strictJson(request, quotaInput),
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
