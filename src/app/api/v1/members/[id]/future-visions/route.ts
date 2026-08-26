import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { visionInput } from "../../../../../../lib/self-understanding/schemas";
import {
  selfRead,
  selfWrite,
} from "../../../../../../lib/self-understanding/http";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const rt = await memberRuntime();
  return withMemberRuntime(req, rt, async (_, p, rid) =>
    success(await selfRead(rt.db, p, id, rid), rid),
  );
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const rt = await memberRuntime();
  return withMemberRuntime(req, rt, async (_, p, rid) => {
    assertMutationRequest(req);
    const repo = await selfWrite(
      rt.db,
      p,
      id,
      rid,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repo.createVision(p, id, await strictJson(req, visionInput), rid),
      rid,
      null,
      201,
    );
  });
}
