import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import {
  supportRead,
  supportWrite,
} from "../../../../../../lib/continuous-support/http";
import { oneOnOneInput } from "../../../../../../lib/continuous-support/schemas";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(
      (await supportRead(runtime.db, principal, id, requestId)).oneOnOnes,
      requestId,
    ),
  );
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    const repository = await supportWrite(
      runtime.db,
      principal,
      id,
      requestId,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repository.createOneOnOne(
        principal,
        id,
        await strictJson(req, oneOnOneInput),
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
