import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { shareRepository } from "../../../../../../lib/share/http";
import { createSnapshotInput } from "../../../../../../lib/share/schemas";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const runtime = await memberRuntime();
  return withMemberRuntime(req, runtime, async (_, principal, requestId) =>
    success(await shareRepository(runtime).list(principal, id), requestId),
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
    const input = await strictJson(req, createSnapshotInput);
    return success(
      await shareRepository(runtime).create(
        principal,
        id,
        input.idempotencyKey,
        requestId,
      ),
      requestId,
      null,
      201,
    );
  });
}
