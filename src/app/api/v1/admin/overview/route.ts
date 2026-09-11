import { adminRepository } from "../../../../../lib/admin/http";
import { success, withMemberRuntime } from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";

export async function GET(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) =>
    success(
      await adminRepository(runtime, principal, "OPERATIONS_READ").dashboard(),
      requestId,
    ),
  );
}
