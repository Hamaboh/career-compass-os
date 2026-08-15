'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label } from '../../../../src/components/ui/primitives';

/** AUTH-03 OTP入力。Phase3 10章: 6桁10分有効、5回まで、再送信は60秒クールダウン。 */
export default function OtpPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post(`/invitations/${token}/verify-otp`, { code });
      router.push(`/invitations/${token}/password`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '通信エラーが発生しました');
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResendPending(true);
    setError(null);
    setResendMessage(null);
    try {
      const res = await api.post<{ expiresInMinutes: number }>(`/invitations/${token}/send-otp`);
      setResendMessage(`新しい認証コードを送信しました（${res.expiresInMinutes}分間有効）。`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '再送信できませんでした。しばらくしてから再度お試しください。');
    } finally {
      setResendPending(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">認証コードを入力してください</h1>
        <p className="mb-5 text-sm text-slate-500">メールに届いた6桁のコードを入力してください。</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="code">認証コード（6桁）</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>
          {error && <ErrorBanner message={error} hint="コードが正しいかご確認ください。届いていない場合は再送信してください。" />}
          {resendMessage && <p className="text-sm text-emerald-600">{resendMessage}</p>}
          <Button type="submit" disabled={pending || code.length !== 6} className="w-full">
            {pending ? '確認中…' : '確認する'}
          </Button>
          <Button type="button" variant="ghost" disabled={resendPending} onClick={() => void resend()}>
            {resendPending ? '送信中…' : 'コードを再送信する'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
