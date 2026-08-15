'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../../../../src/components/ui/primitives';
import { StatusBadge } from '../../../../src/components/shared/status-badge';
import type { Employee, LongTermGoal, OneOnOneSession } from '../../../../src/lib/types';

/** UL-03 メンバー詳細。目標サマリー・1on1履歴の統合ビュー（心理指標等の生データは開示しない）。 */
export default function UlMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const employee = useQuery({ queryKey: ['employees', id], queryFn: () => api.get<Employee>(`/employees/${id}`) });
  const goals = useQuery({
    queryKey: ['long-term-goals', 'ul-view', id],
    queryFn: () => api.get<LongTermGoal[]>(`/long-term-goals?employeeId=${id}`),
  });
  const sessions = useQuery({
    queryKey: ['one-on-one', 'sessions', id],
    queryFn: () => api.get<OneOnOneSession[]>(`/one-on-one/sessions?employeeId=${id}`),
  });

  const startPrep = async () => {
    setPending(true);
    setError(null);
    try {
      const sheet = await api.post<{ id: string }>('/one-on-one/prep-sheets', { employeeId: id });
      router.push(`/ul/one-on-ones/${sheet.id}/prep`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '準備シートを生成できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (employee.isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title={employee.data?.name ?? 'メンバー詳細'} description={employee.data?.email} />
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <div className="mb-4 flex gap-2">
        <Button onClick={() => void startPrep()} disabled={pending}>
          {pending ? '生成中…' : '1on1準備シートを作成'}
        </Button>
      </div>
      <Card className="mb-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">目標サマリー</p>
        {!goals.data || goals.data.length === 0 ? (
          <EmptyState title="目標がまだありません" />
        ) : (
          <ul className="flex flex-col gap-2">
            {goals.data.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm">
                <span>{g.title}</span>
                <StatusBadge status={g.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <p className="mb-2 text-sm font-semibold text-slate-700">1on1履歴</p>
        {!sessions.data || sessions.data.length === 0 ? (
          <EmptyState title="まだ1on1の記録はありません" />
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-slate-600">
            {sessions.data.map((s) => (
              <li key={s.id}>{s.status === 'completed' ? '実施済み' : '予定'}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
