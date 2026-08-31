import { policyRead } from "../../../../../lib/executive/http";
import { businessDayInput } from "../../../../../lib/executive/schemas";
import { strictJson, success, withMemberRuntime } from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function POST(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) => {
    assertMutationRequest(request);
    const input = await strictJson(request, businessDayInput);
    return success(
      policyRead(runtime.db, principal).calculateBusinessDay(
        input.targetMonth,
        input.calendarVersion,
        input.holidays,
      ),
      requestId,
    );
  });
}
