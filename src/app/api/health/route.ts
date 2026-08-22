import { createRequestId, errorEnvelope } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId(request.headers.get("x-request-id"));
  try {
    return Response.json(
      { status: "ok", environment: process.env.APP_ENV ?? "local" },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch {
    return errorEnvelope("INTERNAL_ERROR", requestId);
  }
}
