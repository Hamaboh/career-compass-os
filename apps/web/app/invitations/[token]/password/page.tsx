'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../src/lib/api-client';
import { useAuth, defaultDashboardPath } from '../../../../src/lib/auth-context';
import { Button, Card, ErrorBanner, Input, Label } from '../../../../src/components/ui/primitives';
import type { LoginResponse } from '../../../../src/lib/types';

/** 簡易な強度判定（Phase3 12章: 強度表示はUX上の助言に過ぎず、8文字以上のみが登録可否の判定基準）。 */
function strength(password: string): { label: string; color: string; ratio: number } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { label: '弱い', color: 'bg-red-400' },
    { label: '普通', color: 'bg-amber-400' },
    { label: '強い', color: 'bg-emerald-400' },
    { label: '非常に強い', color: 'bg-emerald-600' },
  ];
  const idx = Math.min(levels.length - 1, Math.max(0, score - 1));
  return { ...levels[idx], ratio: (score / 5) * 100 };
}

/** AUTH-04 パスワード設定（初回）。Phase3 12章の要件チェックリストをリアルタイム表示する。 */
export default function SetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const meetsLength = password.length >= 8 && password.length <= 128;
  const matches = password.length > 0 && password === confirmation;
  const s = strength(password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>(`/invitations/${token}/set-password`, {
        password,
        passwordConfirmation: confirmation,
      });
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
        <h1 className="mb-1 text-lg font-semibold text-slate-900">パスワードを設定してください</h1>
        <p className="mb-5 text-sm text-slate-500">8文字以上の英数字（記号は任意）で設定します。</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password">新しいパスワード</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            {password.length > 0 && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${s.color}`} style={{ width: `${s.ratio}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">強度: {s.label}</p>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="confirmation">確認のため再入力</Label>
            <Input
              id="confirmation"
              type="password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <ul className="space-y-1 text-xs text-slate-500">
            <li className={meetsLength ? 'text-emerald-600' : ''}>{meetsLength ? '✅' : '・'} 8文字以上128文字以内</li>
            <li className={matches ? 'text-emerald-600' : ''}>{matches ? '✅' : '・'} 確認入力が一致している</li>
          </ul>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={pending || !meetsLength || !matches} className="w-full">
            {pending ? '設定中…' : 'パスワードを設定してログイン'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
