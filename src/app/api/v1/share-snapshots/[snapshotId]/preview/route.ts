import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { success, withMemberRuntime } from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { shareRepository } from "../../../../../../lib/share/http";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params;
  idSchema.parse(snapshotId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(
      await shareRepository(runtime).preview(principal, snapshotId),
      requestId,
    ),
  );
}
