import { MemberError } from "./errors";
export function assertMutationRequest(request: Request): void {
  const type = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (type !== "application/json")
    throw new MemberError(
      "UNSUPPORTED_CONTENT_TYPE",
      400,
      "content_type_denied",
    );
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new MemberError("CSRF_REJECTED", 400, "origin_denied");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin")
    throw new MemberError("CSRF_REJECTED", 400, "fetch_site_denied");
  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("cc_csrf="))
    ?.slice(8);
  const header = request.headers.get("x-csrf-token");
  if (
    !cookie ||
    !header ||
    cookie !== header ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(header)
  )
    throw new MemberError("CSRF_REJECTED", 400, "csrf_token_denied");
}
