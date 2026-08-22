import { idSchema, patchMemberSchema } from "../../../../../lib/member/schemas";
import { MemberError } from "../../../../../lib/member/errors";
import { assertMutationRequest } from "../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../lib/member/http";
import { memberRuntime } from "../../../../../lib/member/route-runtime";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) => {
    const id = idSchema.parse((await params).id);
    return success(await s.get(p, id, r), r);
  });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) => {
    assertMutationRequest(request);
    const id = idSchema.parse((await params).id);
    const body = await strictJson(request, patchMemberSchema);
    const match = request.headers.get("if-match");
    if (match && Number(match) !== body.version)
      throw new MemberError("VERSION_CONFLICT", 409, "if_match_conflict");
    return success(
      await s.patch(
        p,
        id,
        body,
        r,
        request.headers.get("x-maintenance-reason") ?? undefined,
      ),
      r,
    );
  });
}
