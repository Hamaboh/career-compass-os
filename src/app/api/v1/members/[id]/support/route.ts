import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { success, withMemberRuntime } from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { supportRead } from "../../../../../../lib/continuous-support/http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(await supportRead(runtime.db, principal, id, requestId), requestId),
  );
}
