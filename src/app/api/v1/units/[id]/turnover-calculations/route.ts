import { policyRead } from "../../../../../../lib/executive/http";
import { turnoverInput } from "../../../../../../lib/executive/schemas";
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
      return success(
        await policyRead(runtime.db, principal).calculateTurnoverForUnit(
          principal,
          id,
          await strictJson(request, turnoverInput),
          requestId,
        ),
        requestId,
        null,
        201,
      );
    },
  );
}
