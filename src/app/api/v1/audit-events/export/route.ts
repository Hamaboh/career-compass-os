import { adminRepository } from "../../../../../lib/admin/http";
import { auditExportInput } from "../../../../../lib/admin/schemas";
import { strictJson, withMemberRuntime } from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function POST(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      const data = await adminRepository(
        runtime,
        principal,
        "OPERATIONS_READ",
      ).exportAudit(
        principal,
        await strictJson(request, auditExportInput),
        requestId,
      );
      return Response.json(data, {
        headers: {
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.json"`,
          "x-request-id": requestId,
        },
      });
    },
  );
}
