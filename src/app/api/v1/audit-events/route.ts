import { auditRepository } from "../../../../lib/admin/http";
import { auditQueryInput } from "../../../../lib/admin/schemas";
import { success, withMemberRuntime } from "../../../../lib/member/http";
import { memberRuntime } from "../../../../lib/member/route-runtime";

export async function GET(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      const raw = Object.fromEntries(
        new URL(request.url).searchParams.entries(),
      );
      return success(
        await auditRepository(runtime, principal).searchAudit(
          principal,
          auditQueryInput.parse(raw),
          requestId,
        ),
        requestId,
      );
    },
  );
}
