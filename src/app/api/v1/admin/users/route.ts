import { adminRepository } from "../../../../../lib/admin/http";
import { userCreateInput } from "../../../../../lib/admin/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function GET(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) =>
    success(
      await adminRepository(
        runtime,
        principal,
        "USER_ACCESS_MANAGE",
      ).listUsers(),
      requestId,
    ),
  );
}

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
          "USER_ACCESS_MANAGE",
        ).createUser(
          principal,
          await strictJson(request, userCreateInput),
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
