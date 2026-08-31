import { memberRuntime } from "../../../../lib/member/route-runtime";
import { success, withMemberRuntime } from "../../../../lib/member/http";
import { ContinuousSupportRepository } from "../../../../lib/continuous-support/repository";

export async function GET(req: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(
      await new ContinuousSupportRepository(runtime.db).notifications(
        principal,
      ),
      requestId,
    ),
  );
}
