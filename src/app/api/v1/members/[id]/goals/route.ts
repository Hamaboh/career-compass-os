import { memberRuntime } from "../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { idSchema } from "../../../../../../lib/member/schemas";
import { goalInput } from "../../../../../../lib/goal/schemas";
import { goalRead, goalWrite } from "../../../../../../lib/goal/http";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  idSchema.parse(id);
  const rt = await memberRuntime();
  return withMemberRuntime(req, rt, async (_, p, rid) =>
    success(await goalRead(rt.db, p, id, rid), rid),
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
    const repo = await goalWrite(
      rt.db,
      p,
      id,
      rid,
      req.headers.get("x-maintenance-reason") ?? undefined,
    );
    return success(
      await repo.create(p, id, await strictJson(req, goalInput), rid),
      rid,
      null,
      201,
    );
  });
}
