import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createRequestId } from "../../../lib/http";
import { MemberError } from "../../../lib/member/errors";
import { publicShareCsp } from "../../../lib/share/html";
import { ShareRepository } from "../../../lib/share/repository";

const headers = (requestId: string, download: boolean) => ({
  "cache-control": "private, no-store, max-age=0",
  "content-security-policy": publicShareCsp,
  "content-type": "text/html; charset=utf-8",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-request-id": requestId,
  "x-robots-tag": "noindex, nofollow, noarchive",
  ...(download
    ? { "content-disposition": 'attachment; filename="career-share.html"' }
    : {}),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ rawToken: string }> },
) {
  const requestId = createRequestId(req.headers.get("x-request-id"));
  try {
    const { rawToken } = await params;
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as {
      DB: D1Database;
      PRIVATE_FILES: R2Bucket;
    };
    const html = await new ShareRepository(
      env.DB,
      env.PRIVATE_FILES,
    ).publicHtml(
      rawToken,
      requestId,
      req.headers.get("cf-connecting-ip") ?? "unknown",
    );
    return new Response(html, {
      status: 200,
      headers: headers(
        requestId,
        new URL(req.url).searchParams.get("download") === "1",
      ),
    });
  } catch (error) {
    const status = error instanceof MemberError ? error.status : 500;
    const body =
      '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>共有リンク</title></head><body><h1>共有内容を表示できません</h1><p>リンクの期限または失効状態を確認してください。</p></body></html>';
    return new Response(body, {
      status: status === 500 ? 500 : status === 429 ? 429 : 404,
      headers: headers(requestId, false),
    });
  }
}
