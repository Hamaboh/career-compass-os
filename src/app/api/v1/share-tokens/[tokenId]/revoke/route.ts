import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { shareRepository } from "../../../../../../lib/share/http";
import { revokeTokenInput } from "../../../../../../lib/share/schemas";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await params;
  idSchema.parse(tokenId);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) => {
    assertMutationRequest(req);
    const input = await strictJson(req, revokeTokenInput);
    return success(
      await shareRepository(runtime).revokeToken(
        principal,
        tokenId,
        input.version,
        requestId,
      ),
      requestId,
    );
  });
}
