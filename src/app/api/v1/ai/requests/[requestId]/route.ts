import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { success, withMemberRuntime } from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { aiRepository } from "../../../../../../lib/ai-safety/http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { requestId: id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(await aiRepository(runtime).get(principal, id), requestId),
  );
}
