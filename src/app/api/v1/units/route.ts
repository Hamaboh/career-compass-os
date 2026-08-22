import { memberRuntime } from "../../../../lib/member/route-runtime";
import { success, withMemberRuntime } from "../../../../lib/member/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withMemberRuntime(request, await memberRuntime(), async (s, p, r) =>
    success(await s.units(p, r), r),
  );
}
