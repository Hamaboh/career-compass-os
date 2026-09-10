import { adminRepository } from "../../../../../lib/admin/http";
import { incidentSwitchInput } from "../../../../../lib/admin/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";

export async function PATCH(request: Request) {
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
          "AI_CONFIG_MANAGE",
        ).updateIncidentSwitches(
          principal,
          await strictJson(request, incidentSwitchInput),
          requestId,
        ),
        requestId,
      );
    },
  );
}
