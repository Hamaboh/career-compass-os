import { adminRepository } from "../../../../../lib/admin/http";
import { retentionScanInput } from "../../../../../lib/admin/schemas";
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
        "RETENTION_MANAGE",
      ).listRetention(),
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
          "RETENTION_MANAGE",
        ).scanRetention(
          principal,
          await strictJson(request, retentionScanInput),
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
