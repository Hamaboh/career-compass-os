import { policyRead, policyWrite } from "../../../../lib/executive/http";
import { holidayCalendarInput } from "../../../../lib/executive/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../lib/member/http";
import { memberRuntime } from "../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../lib/member/security";

export async function GET(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) =>
    success(await policyRead(runtime.db, principal).listPolicies(), requestId),
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
        await policyWrite(runtime.db, principal).createHolidayCalendar(
          principal,
          await strictJson(request, holidayCalendarInput),
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
