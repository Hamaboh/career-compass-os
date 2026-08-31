import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import { success, withMemberRuntime } from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { ContinuousSupportRepository } from "../../../../../../lib/continuous-support/repository";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await params;
  idSchema.parse(notificationId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    return success(
      await new ContinuousSupportRepository(runtime.db).markNotificationRead(
        principal,
        notificationId,
        requestId,
      ),
      requestId,
    );
  });
}
