'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label } from '../../src/components/ui/primitives';

/**
 * AUTH-05 パスワードリセット申請。Phase3 16.7節: メール送信の有無に関わらず同一表示にする
 * （アカウント存在の推測を防ぐ）。
 */
export default function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/password-reset/request', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">パスワードリセット</h1>
        {sent ? (
          <p className="mt-4 text-sm text-slate-600">メールをご確認ください。リセット用のリンクをお送りしました。</p>
        ) : (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <ErrorBanner message={error} />}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? '送信中…' : 'リセットメールを送信'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
