'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '../../src/lib/api-client';
import { useAuth, defaultDashboardPath } from '../../src/lib/auth-context';
import { Button, Card, Input, Label, ErrorBanner } from '../../src/components/ui/primitives';
import type { LoginResponse } from '../../src/lib/types';

/** AUTH-01 ログイン。Phase4 5.2節: メール/パスワード入力欄のみの簡易フォーム。 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      await refresh();
      router.push(defaultDashboardPath(res.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">羅針盤キャリアOS</h1>
        <p className="mb-5 text-sm text-slate-500">メールアドレスとパスワードでログイン</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <ErrorBanner message={error} hint="メールアドレスとパスワードをご確認のうえ、再度お試しください。" />}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'ログイン中…' : 'ログイン'}
          </Button>
        </form>
        <Link href="/password-reset" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">
          パスワードをお忘れですか
        </Link>
      </Card>
    </div>
  );
}
