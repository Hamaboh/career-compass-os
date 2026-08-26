import { memberRuntime } from "../../../../../../../lib/member/route-runtime";
import { assertMutationRequest } from "../../../../../../../lib/member/security";
import {
  strictJson,
  success,
  withMemberRuntime,
} from "../../../../../../../lib/member/http";
import { idSchema } from "../../../../../../../lib/member/schemas";
import { SelfUnderstandingRepository } from "../../../../../../../lib/self-understanding/repository";
import { sessionTransitionInput } from "../../../../../../../lib/self-understanding/schemas";
import { authorize } from "../../../../../../../lib/auth/policy";
import { D1AuditWriter } from "../../../../../../../lib/auth/audit";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = idSchema.parse((await params).id),
    rt = await memberRuntime();
  return withMemberRuntime(req, rt, async (_, p, rid) => {
    assertMutationRequest(req);
    const repo = new SelfUnderstandingRepository(rt.db),
      row = await repo.session(p, id, false),
      reason = req.headers.get("x-maintenance-reason") ?? undefined;
    await authorize(
      p,
      {
        capability:
          p.capabilities.includes("UNIT_EDIT_SCOPED") && !reason
            ? "UNIT_EDIT_SCOPED"
            : "BUSINESS_EDIT_MAINTENANCE",
        resourceUnitId: row.unit_id,
        concealExistence: true,
        maintenanceReason: reason,
        targetType: "self_analysis_session",
        targetId: id,
      },
      new D1AuditWriter(rt.db),
      rid,
    );
    return success(
      await repo.transitionSession(
        p,
        id,
        await strictJson(req, sessionTransitionInput),
        rid,
      ),
      rid,
    );
  });
}
