'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api, ApiError } from '../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Select, Textarea } from '../../src/components/ui/primitives';
import { formatDate } from '../../src/lib/labels';
import type { LongTermGoal, Reflection } from '../../src/lib/types';

/** MEM-12 振り返り。Reflection一覧・新規作成。対象目標を選び自由記述で書く。 */
export default function ReflectionsPage() {
  return (
    <RequireAuth>
      <ReflectionsFlow />
    </RequireAuth>
  );
}

function ReflectionsFlow() {
  const qc = useQueryClient();
  const [goalId, setGoalId] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const goals = useQuery({ queryKey: ['long-term-goals'], queryFn: () => api.get<LongTermGoal[]>('/long-term-goals') });
  const reflections = useQuery({
    queryKey: ['reflections', goalId],
    queryFn: () => api.get<Reflection[]>(`/reflections?longTermGoalId=${goalId}`),
    enabled: !!goalId,
  });

  const submit = async () => {
    if (!goalId) return;
    setPending(true);
    setError(null);
    try {
      await api.post('/reflections', { longTermGoalId: goalId, content });
      setContent('');
      await qc.invalidateQueries({ queryKey: ['reflections', goalId] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (goals.isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="振り返り" />
      {!goals.data || goals.data.length === 0 ? (
        <EmptyState title="振り返る目標がまだありません" />
      ) : (
        <>
          <Card className="mb-4">
            <Select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="mb-3">
              <option value="">目標を選んでください</option>
              {goals.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            {goalId && (
              <>
                <Textarea rows={4} placeholder="今回の振り返りを書いてください" value={content} onChange={(e) => setContent(e.target.value)} />
                {error && (
                  <div className="mt-2">
                    <ErrorBanner message={error} />
                  </div>
                )}
                <Button className="mt-2" onClick={() => void submit()} disabled={pending || content.trim().length === 0}>
                  {pending ? '保存中…' : '記録する'}
                </Button>
              </>
            )}
          </Card>
          {goalId &&
            (!reflections.data || reflections.data.length === 0 ? (
              <EmptyState title="まだ振り返りがありません" />
            ) : (
              <ul className="flex flex-col gap-2">
                {reflections.data.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    {r.prompt && <p className="mb-1 text-xs text-slate-400">問い: {r.prompt}</p>}
                    <p className="text-slate-700">{r.content}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </div>
  );
}
