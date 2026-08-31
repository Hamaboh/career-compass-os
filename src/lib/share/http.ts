import type { MemberRuntime } from "../member/http";
import { MemberError } from "../member/errors";
import { ShareRepository } from "./repository";

export function shareRepository(runtime: MemberRuntime) {
  if (!runtime.privateFiles)
    throw new MemberError(
      "SHARE_UNAVAILABLE",
      503,
      "private_snapshot_store_unavailable",
    );
  return new ShareRepository(runtime.db, runtime.privateFiles);
}
