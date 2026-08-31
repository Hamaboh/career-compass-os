import { policyRead } from "../../../../../lib/executive/http";
import { responseWindowInput } from "../../../../../lib/executive/schemas";
import { strictJson, success, withMemberRuntime } from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function POST(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) => {
    assertMutationRequest(request);
    const input = await strictJson(request, responseWindowInput);
    return success(
      policyRead(runtime.db, principal).calculateResponseWindow(
        input.contactAt,
        input.responseAt,
        input.referenceAt,
      ),
      requestId,
    );
  });
}
