import {
  cursorQuerySchema,
  createMemberSchema,
  idSchema,
} from "../../../../../../lib/member/schemas";
import { assertMutationRequest } from "../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../lib/member/http";
import { memberRuntime } from "../../../../../../lib/member/route-runtime";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) => {
    const id = idSchema.parse((await params).id);
    const q = cursorQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const page = await s.list(p, id, q.cursor, q.limit, r);
    return success(page.items, r, page.nextCursor);
  });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) => {
    assertMutationRequest(request);
    const id = idSchema.parse((await params).id);
    const body = await strictJson(request, createMemberSchema);
    return success(
      await s.create(
        p,
        id,
        body,
        r,
        request.headers.get("x-maintenance-reason") ?? undefined,
      ),
      r,
      null,
      201,
    );
  });
}
