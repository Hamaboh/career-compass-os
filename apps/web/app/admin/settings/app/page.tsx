'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label, PageHeader } from '../../../../src/components/ui/primitives';
import type { AppSettings } from '../../../../src/lib/types';

/**
 * ADM-09 アプリ設定。通知既定値・リマインド閾値等の全社設定。
 * Phase4 2.4節ADM-10の注記どおり、MVPではAI設定の独立画面を作らず、
 * 本画面内の折りたたみセクションとして最小プレースホルダーのみ提供する。
 */
export default function AdminAppSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['app-settings'], queryFn: () => api.get<AppSettings>('/app-settings') });
  const [interimDays, setInterimDays] = useState(14);
  const [smartDays, setSmartDays] = useState(90);
  const [digest, setDigest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (data) {
      setInterimDays(data.defaultInterimCheckDays);
      setSmartDays(data.defaultSmartRecheckDays);
      setDigest(data.notificationDigestEnabled);
    }
  }, [data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      await api.patch('/app-settings', {
        defaultInterimCheckDays: interimDays,
        defaultSmartRecheckDays: smartDays,
        notificationDigestEnabled: digest,
      });
      setSuccess(true);
      await qc.invalidateQueries({ queryKey: ['app-settings'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHeader title="アプリ設定" />
      <Card className="max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="interim">既定の中間確認間隔（日）</Label>
            <Input id="interim" type="number" min={1} max={90} value={interimDays} onChange={(e) => setInterimDays(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="smart">SMART再確認までの既定日数</Label>
            <Input id="smart" type="number" min={1} max={365} value={smartDays} onChange={(e) => setSmartDays(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} className="h-4 w-4" />
            通知をダイジェスト配信にする（将来拡張予定の機能設定を先行して持たせています）
          </label>
          {error && <ErrorBanner message={error} />}
          {success && <p className="text-sm text-emerald-600">保存しました</p>}
          <Button type="submit" disabled={pending}>
            {pending ? '保存中…' : '保存する'}
          </Button>
        </form>
      </Card>
      <Card className="mt-4 max-w-md">
        <button onClick={() => setAiOpen((v) => !v)} className="text-sm font-semibold text-slate-700">
          {aiOpen ? '▼' : '▶'} AI設定（詳細は今後追加予定）
        </button>
        {aiOpen && (
          <p className="mt-2 text-sm text-slate-500">
            モデル階層化・コスト関連パラメータの運用管理はMVP後の拡張範囲です（Phase4 17章参照）。
          </p>
        )}
      </Card>
    </div>
  );
}
