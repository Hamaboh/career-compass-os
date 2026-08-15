/**
 * Phase3 13.1/16.3節準拠のAPIクライアント。ベースパスは`/api/v1`（Caddyが`/api/*`を
 * apiサービスへプロキシし、NestJS側は`v1`プレフィックスのみを見る、apps/api/src/main.ts参照）。
 * 認可はサーバー側の__Host-session Cookieのみに依存し(認証はCookie送信のみで完結)、
 * 状態変更リクエストにはcsrf_token Cookieの値をX-CSRF-Tokenヘッダとして必ず付与する
 * （Double Submit Cookie、Phase3 16.3節）。フロントエンドの表示制御は利便性のためのみであり、
 * 実際の認可は常にサーバー側で行われる（Phase3 16.10節）ことを前提に、
 * このクライアントは「403/401が返ってきたら呼び出し元に伝える」以上のことをしない。
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | null,
  ) {
    super(body?.error?.message ?? `APIエラー (status=${status})`);
    this.name = 'ApiError';
  }

  get code(): string | undefined {
    return this.body?.error?.code;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (!SAFE_METHODS.has(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`/api/v1${path}`, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, json as ApiErrorBody | null);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
