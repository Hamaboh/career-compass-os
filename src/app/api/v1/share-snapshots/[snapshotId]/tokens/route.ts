import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { shareRepository } from "../../../../../../lib/share/http";
import { createTokenInput } from "../../../../../../lib/share/schemas";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId } = await params;
  idSchema.parse(snapshotId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    const input = await strictJson(req, createTokenInput);
    return success(
      await shareRepository(runtime).createToken(
        principal,
        snapshotId,
        input.version,
        input.expiresInDays,
        input.idempotencyKey,
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
