'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, ErrorBanner, LoadingBlock } from '../../../src/components/ui/primitives';

interface InvitationInfo {
  name: string;
  email: string;
  role: string;
  status: string;
}

/** AUTH-02 招待受諾（ランディング）。 */
export default function InvitationLandingPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api
      .get<InvitationInfo>(`/invitations/${token}`)
      .then(setInfo)
      .catch((e) => setError(e instanceof ApiError ? e.message : '招待リンクを確認できませんでした'));
  }, [token]);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/invitations/${token}/send-otp`);
      router.push(`/invitations/${token}/otp`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '通信エラーが発生しました');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">羅針盤キャリアOSへようこそ</h1>
        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} hint="招待リンクが無効または期限切れの場合は、管理者に再招待を依頼してください。" />
          </div>
        )}
        {!info && !error && <LoadingBlock />}
        {info && (
          <>
            <p className="mt-3 text-sm text-slate-600">
              {info.name} 様（{info.email}）を招待しています。
            </p>
            <p className="mt-1 text-xs text-slate-400">内容に誤りがある場合は管理者に連絡してください。</p>
            <Button onClick={() => void start()} disabled={pending} className="mt-6 w-full">
              {pending ? '送信中…' : '本人確認を始める'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
