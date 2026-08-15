'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, PageHeader } from '../../../../src/components/ui/primitives';
import { formatDateTime } from '../../../../src/lib/labels';
import type { ProgressEntry } from '../../../../src/lib/types';

const QUICK_OPTIONS = [
  { label: '順調', percent: 75 },
  { label: 'やや遅れ', percent: 50 },
  { label: '停滞', percent: 25 },
  { label: '相談したい', percent: 10 },
];

/** MEM-11 進捗。Phase4 12.2節: 選択式を基本とし自由記述は任意にする。 */
export default function ProgressPage() {
  return (
    <RequireAuth>
      <ProgressCheckin />
    </RequireAuth>
  );
}

function ProgressCheckin() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const entries = useQuery({
    queryKey: ['progress-entries', id],
    queryFn: () => api.get<ProgressEntry[]>(`/progress-entries?checkpointId=${id}`),
  });

  const submit = async (percent: number, label: string) => {
    setPending(true);
    setError(null);
    try {
      await api.post('/progress-entries', { checkpointId: id, percentComplete: percent, statusNote: note || label });
      setNote('');
      await qc.invalidateQueries({ queryKey: ['progress-entries', id] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '記録できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHeader title="進捗チェックイン" />
      <Card className="mb-4">
        <p className="mb-2 text-sm font-medium text-slate-700">いまの状況は？</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_OPTIONS.map((o) => (
            <Button key={o.label} variant="secondary" disabled={pending} onClick={() => void submit(o.percent, o.label)}>
              {o.label}
            </Button>
          ))}
        </div>
        <input
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="コメント（任意）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
      </Card>
      {!entries.data || entries.data.length === 0 ? (
        <EmptyState title="まだ進捗の記録がありません" />
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.data.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{entry.percentComplete}%</span>
                <span className="text-xs text-slate-400">{formatDateTime(entry.recordedAt)}</span>
              </div>
              <p className="mt-1 text-slate-600">{entry.statusNote}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
