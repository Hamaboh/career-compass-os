import { memberRuntime } from "../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../lib/member/http";
import { ContinuousSupportRepository } from "../../../../../lib/continuous-support/repository";
import { notificationRunInput } from "../../../../../lib/continuous-support/schemas";

export async function POST(req: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    await strictJson(req, notificationRunInput);
    return success(
      await new ContinuousSupportRepository(runtime.db).materializeDue(
        principal,
        new Date().toISOString(),
        requestId,
      ),
      requestId,
    );
  });
}
