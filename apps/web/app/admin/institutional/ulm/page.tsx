'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Badge, Button, Card, ErrorBanner, Input, PageHeader, Select, Textarea } from '../../../../src/components/ui/primitives';
import type { Unit, UlmMaster } from '../../../../src/lib/types';

const STATUS_STYLE: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', provisional: 'bg-amber-100 text-amber-700', archived: 'bg-slate-100 text-slate-400' };
const STATUS_LABEL: Record<string, string> = { active: '公開中', provisional: '下書き', archived: 'アーカイブ' };

/** ADM-08 Unit Leaders Mission管理。ULMマスタの登録・改定・公開。 */
export default function AdminUlmPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const ulms = useQuery({ queryKey: ['ulm-master'], queryFn: () => api.get<UlmMaster[]>('/ulm-master') });
  const units = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/ulm-master', { title, description: description || undefined, unitId: unitId || undefined });
      setTitle('');
      setDescription('');
      await qc.invalidateQueries({ queryKey: ['ulm-master'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  const publish = async (id: string) => {
    setError(null);
    try {
      const res = await api.post<{ affectedConnectionCount: number }>(`/ulm-master/${id}/publish`);
      if (res.affectedConnectionCount > 0) window.alert(`${res.affectedConnectionCount}件の既存の接続が見直し対象になります。`);
      await qc.invalidateQueries({ queryKey: ['ulm-master'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '公開できませんでした');
    }
  };

  return (
    <div>
      <PageHeader title="Unit Leaders Mission管理" />
      <Card className="mb-4 max-w-lg">
        <form onSubmit={create} className="flex flex-col gap-3">
          <Input placeholder="ULMタイトル" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="説明（任意）" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">全Unit共通</option>
            {units.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={pending}>
            {pending ? '作成中…' : '新しいULMを作成'}
          </Button>
        </form>
      </Card>
      <div className="flex flex-col gap-3">
        {ulms.data?.map((u) => (
          <Card key={u.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{u.title}</p>
                {u.description && <p className="mt-1 text-sm text-slate-500">{u.description}</p>}
                <p className="mt-1 text-xs text-slate-400">v{u.versionNo}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_STYLE[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                {u.status === 'provisional' && (
                  <button onClick={() => void publish(u.id)} className="text-xs text-emerald-600 underline">
                    公開する
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
