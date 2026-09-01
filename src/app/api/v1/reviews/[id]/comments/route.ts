import { scopedReviewWrite } from "../../../../../../lib/executive/http";
import { ExecutiveRepository } from "../../../../../../lib/executive/repository";
import { reviewCommentInput } from "../../../../../../lib/executive/schemas";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { idSchema } from "../../../../../../lib/member/schemas";
import { assertMutationRequest } from "../../../../../../lib/member/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(
    request,
    runtime,
    async (_, principal, requestId) => {
      assertMutationRequest(request);
      const input = await strictJson(request, reviewCommentInput);
      const current = await new ExecutiveRepository(runtime.db).reviewUnit(id);
      return success(
        await scopedReviewWrite(
          runtime.db,
          principal,
          current.unit_id,
          input.disposition,
        ).addReviewComment(principal, id, input, requestId),
        requestId,
        null,
        201,
      );
    },
  );
}
