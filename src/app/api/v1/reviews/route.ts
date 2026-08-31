import { ExecutiveRepository } from "../../../../lib/executive/repository";
import { reviewInput } from "../../../../lib/executive/schemas";
import { strictJson, success, withMemberRuntime } from "../../../../lib/member/http";
import { memberRuntime } from "../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../lib/member/security";
import { scopedReviewWrite } from "../../../../lib/executive/http";

export async function GET(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) =>
    success(await new ExecutiveRepository(runtime.db).listReviews(principal), requestId),
  );
}

export async function POST(request: Request) {
  const runtime = await memberRuntime();
  return withMemberRuntime(request, runtime, async (_, principal, requestId) => {
    assertMutationRequest(request);
    const input = await strictJson(request, reviewInput);
    return success(
      await scopedReviewWrite(runtime.db, principal, input.unitId).createReview(
        principal,
        input,
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
