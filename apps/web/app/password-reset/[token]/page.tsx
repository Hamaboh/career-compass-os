'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label } from '../../../src/components/ui/primitives';

/** AUTH-06 パスワードリセット実行。完了後は通常ログイン(AUTH-01)へ誘導する（自動ログインしない）。 */
export default function PasswordResetConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/password-reset/confirm', { token, password, passwordConfirmation: confirmation });
      router.push('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">新しいパスワードを設定</h1>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor="password">新しいパスワード</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="confirmation">確認のため再入力</Label>
            <Input id="confirmation" type="password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          {error && <ErrorBanner message={error} hint="リンクの有効期限が切れている場合は、再度リセットを申請してください。" />}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? '設定中…' : 'パスワードを更新'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
