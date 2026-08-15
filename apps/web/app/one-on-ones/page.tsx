'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api } from '../../src/lib/api-client';
import { Card, EmptyState, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import { formatDateTime } from '../../src/lib/labels';
import type { OneOnOneSession } from '../../src/lib/types';

/** MEM-13 1on1（自分の分）。予定・履歴の一覧。 */
export default function OneOnOnesPage() {
  return (
    <RequireAuth>
      <List />
    </RequireAuth>
  );
}

function List() {
  const { data, isLoading } = useQuery({ queryKey: ['one-on-one', 'me'], queryFn: () => api.get<OneOnOneSession[]>('/one-on-one/sessions/me') });

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="1on1" />
      {!data || data.length === 0 ? (
        <EmptyState title="まだ1on1の記録はありません" description="次の1on1が近づくとここに準備状況が表示されます。" />
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((s) => (
            <Link key={s.id} href={`/one-on-ones/${s.id}`}>
              <Card className="cursor-pointer transition hover:border-slate-400">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{s.status === 'completed' ? '実施済み' : s.status === 'cancelled' ? '中止' : '予定'}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(s.scheduledAt ?? s.heldAt ?? s.createdAt)}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
