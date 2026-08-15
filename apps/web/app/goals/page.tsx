'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api } from '../../src/lib/api-client';
import { Button, Card, EmptyState, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import { StatusBadge } from '../../src/components/shared/status-badge';
import { formatDate } from '../../src/lib/labels';
import type { LongTermGoal } from '../../src/lib/types';

/** MEM-06 目標一覧。Phase4 5章アーキタイプA: LongTermGoalカード（ステータスバッジ付き）。 */
export default function GoalsPage() {
  return (
    <RequireAuth>
      <GoalsList />
    </RequireAuth>
  );
}

function GoalsList() {
  const { data, isLoading } = useQuery({ queryKey: ['long-term-goals'], queryFn: () => api.get<LongTermGoal[]>('/long-term-goals') });

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="目標一覧" />
        <Link href="/goals/new">
          <Button>＋新しい目標</Button>
        </Link>
      </div>
      {!data || data.length === 0 ? (
        <EmptyState title="まだ目標がありません" action={<Link href="/goals/new"><Button>＋新しい目標</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`}>
              <Card className="h-full cursor-pointer transition hover:border-slate-400">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{g.title}</p>
                  <StatusBadge status={g.status} />
                </div>
                {g.targetDate && <p className="mt-2 text-xs text-slate-500">期限: {formatDate(g.targetDate)}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
