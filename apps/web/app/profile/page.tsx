'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api, ApiError } from '../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label, PageHeader } from '../../src/components/ui/primitives';
import type { Employee } from '../../src/lib/types';

/** MEM-16 プロフィール。基本情報表示（編集不可項目を明示）・パスワード変更セクション。 */
export default function ProfilePage() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const { data: me } = useQuery({ queryKey: ['employees', 'me'], queryFn: () => api.get<Employee>('/employees/me') });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<{ message: string }>('/auth/change-password', {
        currentPassword,
        newPassword,
        newPasswordConfirmation: confirmation,
      });
      setSuccess(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '変更できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHeader title="プロフィール" />
      <div className="flex flex-col gap-4">
        <Card>
          <p className="mb-3 text-sm font-semibold text-slate-700">基本情報</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-400">氏名</dt>
            <dd className="text-slate-800">{me?.name ?? '—'}</dd>
            <dt className="text-slate-400">メールアドレス</dt>
            <dd className="text-slate-800">{me?.email ?? '—'}</dd>
            <dt className="text-slate-400">ロール</dt>
            <dd className="text-slate-800">{me?.role ?? '—'}</dd>
          </dl>
          <p className="mt-3 text-xs text-slate-400">氏名・所属の変更は管理者にご依頼ください。</p>
        </Card>
        <Card className="max-w-md">
          <p className="mb-3 text-sm font-semibold text-slate-700">パスワード変更</p>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="current">現在のパスワード</Label>
              <Input id="current" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new">新しいパスワード</Label>
              <Input id="new" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="confirm">確認のため再入力</Label>
              <Input id="confirm" type="password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </div>
            {error && <ErrorBanner message={error} />}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? '変更中…' : 'パスワードを変更'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
