'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Badge, Button, Card, ErrorBanner, Input, PageHeader, Textarea } from '../../../../src/components/ui/primitives';
import type { KpiMaster } from '../../../../src/lib/types';

const STATUS_STYLE: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', provisional: 'bg-amber-100 text-amber-700', archived: 'bg-slate-100 text-slate-400' };
const STATUS_LABEL: Record<string, string> = { active: '公開中', provisional: '下書き', archived: 'アーカイブ' };

/** ADM-07 KPI管理。KPIマスタの登録・改定・公開（バージョン管理、Phase4 10.2節の影響件数プレビュー）。 */
export default function AdminKpiPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  const kpis = useQuery({ queryKey: ['kpi-master'], queryFn: () => api.get<KpiMaster[]>('/kpi-master') });
  const versions = useQuery({
    queryKey: ['kpi-master', 'versions', expandedFamily],
    queryFn: () => api.get<KpiMaster[]>(`/kpi-master/${expandedFamily}/versions`),
    enabled: !!expandedFamily,
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/kpi-master', { title, description: description || undefined });
      setTitle('');
      setDescription('');
      await qc.invalidateQueries({ queryKey: ['kpi-master'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  const publish = async (id: string) => {
    setError(null);
    try {
      const res = await api.post<{ affectedConnectionCount: number }>(`/kpi-master/${id}/publish`);
      if (res.affectedConnectionCount > 0) {
        window.alert(`この変更により、${res.affectedConnectionCount}件の既存の接続が見直し対象になります。`);
      }
      await qc.invalidateQueries({ queryKey: ['kpi-master'] });
      await qc.invalidateQueries({ queryKey: ['kpi-master', 'versions'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '公開できませんでした');
    }
  };

  return (
    <div>
      <PageHeader title="KPI管理" />
      <Card className="mb-4 max-w-lg">
        <form onSubmit={create} className="flex flex-col gap-3">
          <Input placeholder="KPIタイトル" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="説明（任意）" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={pending}>
            {pending ? '作成中…' : '新しいKPIを作成'}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-3">
        {kpis.data?.map((k) => (
          <Card key={k.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{k.title}</p>
                {k.description && <p className="mt-1 text-sm text-slate-500">{k.description}</p>}
                <p className="mt-1 text-xs text-slate-400">v{k.versionNo}</p>
              </div>
              <Badge className={STATUS_STYLE[k.status]}>{STATUS_LABEL[k.status]}</Badge>
            </div>
            <button
              onClick={() => setExpandedFamily(expandedFamily === k.kpiFamilyId ? null : k.kpiFamilyId)}
              className="mt-2 text-xs text-slate-500 underline"
            >
              バージョン履歴
            </button>
            {expandedFamily === k.kpiFamilyId && versions.data && (
              <ul className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2">
                {versions.data.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      v{v.versionNo} {v.title} {v.changeReason && `（${v.changeReason}）`}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge className={STATUS_STYLE[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                      {v.status === 'provisional' && (
                        <button onClick={() => void publish(v.id)} className="text-emerald-600 underline">
                          公開する
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
