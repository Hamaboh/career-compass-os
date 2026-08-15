'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader } from '../../../../src/components/ui/primitives';
import { ACTION_STATUS_LABELS, formatDate } from '../../../../src/lib/labels';
import type { Action } from '../../../../src/lib/types';

/** MEM-10 行動計画。Actionチェックリスト・Evidence添付・完了操作。 */
export default function ActionsPage() {
  return (
    <RequireAuth>
      <ActionsList />
    </RequireAuth>
  );
}

function ActionsList() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const actions = useQuery({
    queryKey: ['actions', 'checkpoint', id],
    queryFn: () => api.get<Action[]>(`/actions?checkpointId=${id}`),
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/actions', { checkpointId: id, title, dueDate: dueDate || undefined });
      setTitle('');
      setDueDate('');
      await qc.invalidateQueries({ queryKey: ['actions', 'checkpoint', id] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '追加できませんでした');
    }
  };

  const toggleDone = async (action: Action) => {
    setError(null);
    try {
      await api.patch(`/actions/${action.id}/status`, { status: action.status === 'done' ? 'in_progress' : 'done' });
      await qc.invalidateQueries({ queryKey: ['actions', 'checkpoint', id] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新できませんでした');
    }
  };

  return (
    <div>
      <PageHeader title="行動計画" />
      <Card className="mb-4">
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <Input placeholder="新しい行動を追加" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Input type="date" className="w-40" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit">追加</Button>
        </form>
      </Card>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {!actions.data || actions.data.length === 0 ? (
        <EmptyState title="まだ行動がありません" />
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.data.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex flex-1 items-center gap-3">
                <input type="checkbox" checked={a.status === 'done'} onChange={() => void toggleDone(a)} className="h-4 w-4" />
                <span className={a.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'}>{a.title}</span>
              </label>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {a.dueDate && <span>{formatDate(a.dueDate)}</span>}
                <span>{ACTION_STATUS_LABELS[a.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
