'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Textarea } from '../../../src/components/ui/primitives';
import { StatusBadge } from '../../../src/components/shared/status-badge';
import { formatDate } from '../../../src/lib/labels';
import type { Checkpoint, InstitutionalConnection, LongTermGoal, WhyRecord } from '../../../src/lib/types';

/**
 * MEM-07 目標詳細。Checkpointタイムライン・Why要約・制度接続を統合表示する。
 * Phase4 23.9 K1「Why要約カードとKPI/ULM接続バッジは同等以上の視覚的重みで並置し、
 * どちらかを小さく／下部に格納しない」を守るレイアウト。
 */
export default function GoalDetailPage() {
  return (
    <RequireAuth>
      <GoalDetail />
    </RequireAuth>
  );
}

function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [discontinuing, setDiscontinuing] = useState(false);
  const [reason, setReason] = useState('');

  const goal = useQuery({ queryKey: ['long-term-goal', id], queryFn: () => api.get<LongTermGoal>(`/long-term-goals/${id}`) });
  const checkpoints = useQuery({
    queryKey: ['checkpoints', id],
    queryFn: () => api.get<Checkpoint[]>(`/long-term-goals/${id}/checkpoints`),
  });
  const why = useQuery({
    queryKey: ['why-records', 'long_term_goal', id],
    queryFn: () => api.get<WhyRecord[]>(`/why-records?subjectType=long_term_goal&subjectId=${id}`),
  });
  const connections = useQuery({
    queryKey: ['institutional-connections', 'long_term_goal', id],
    queryFn: () => api.get<InstitutionalConnection[]>(`/institutional-connections?connectableType=long_term_goal&connectableId=${id}`),
  });

  const discontinue = async () => {
    setError(null);
    try {
      await api.post(`/long-term-goals/${id}/discontinue`, { reason: reason || undefined });
      await qc.invalidateQueries({ queryKey: ['long-term-goal', id] });
      await qc.invalidateQueries({ queryKey: ['long-term-goals'] });
      setDiscontinuing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '処理できませんでした');
    }
  };

  if (goal.isLoading) return <LoadingBlock />;
  if (!goal.data) return <ErrorBanner message="目標が見つかりません" />;
  const g = goal.data;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader title={g.title} description={g.description ?? undefined} />
        <StatusBadge status={g.status} />
      </div>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {g.status !== 'confirmed' && g.status !== 'active' && (
          <Link href={`/goals/${id}/smart-check`}>
            <Button variant="secondary">SMARTチェックへ</Button>
          </Link>
        )}
        {(g.status === 'confirmed' || g.status === 'active') && (
          <Button
            variant="secondary"
            onClick={async () => {
              setError(null);
              try {
                await api.post(`/long-term-goals/${id}/achieve`);
                await qc.invalidateQueries({ queryKey: ['long-term-goal', id] });
              } catch (e) {
                setError(e instanceof ApiError ? e.message : '処理できませんでした');
              }
            }}
          >
            達成済みにする
          </Button>
        )}
        {g.status !== 'discontinued' && g.status !== 'achieved' && g.status !== 'archived' && (
          <Button variant="danger" onClick={() => setDiscontinuing(true)}>
            この目標をやめる
          </Button>
        )}
      </div>

      {discontinuing && (
        <Card className="mb-4">
          <p className="text-sm text-slate-700">この目標をやめますか？データは残ります。一覧からは非表示になります。</p>
          <Textarea rows={2} className="mt-2" placeholder="理由（任意）" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={() => void discontinue()}>
              やめる
            </Button>
            <Button variant="ghost" onClick={() => setDiscontinuing(false)}>
              キャンセル
            </Button>
          </div>
        </Card>
      )}

      {/* Why要約とKPI/ULM接続は同等の視覚的重みで並置する(Phase4 23.9 K1) */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-slate-700">あなたのWhy</p>
          {why.data && why.data.length > 0 ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{why.data[why.data.length - 1].userText}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-400">まだ記録がありません</p>
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-700">会社制度との接続</p>
          {connections.data && connections.data.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {connections.data.map((c) => (
                <li key={c.id} className="text-sm text-slate-700">
                  {c.institutionType.toUpperCase()}接続・{c.relevanceLabel}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">未接続</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">通過点</p>
        </div>
        {!checkpoints.data || checkpoints.data.length === 0 ? (
          <EmptyState title="まだ通過点がありません" />
        ) : (
          <ul className="flex flex-col gap-3">
            {checkpoints.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <Link href={`/checkpoints/${c.id}/actions`} className="font-medium text-slate-900 hover:underline">
                    {c.title}
                  </Link>
                  {c.targetDate && <p className="text-xs text-slate-500">期限: {formatDate(c.targetDate)}</p>}
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 flex gap-2">
        <Link href={`/checkpoints/${checkpoints.data?.[0]?.id ?? ''}/progress`}>
          <Button variant="secondary" disabled={!checkpoints.data?.[0]}>
            進捗を記録
          </Button>
        </Link>
        <Link href="/reflections">
          <Button variant="secondary">振り返りを書く</Button>
        </Link>
      </div>
    </div>
  );
}
