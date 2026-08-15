'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, LoadingBlock, PageHeader, Textarea } from '../../../../../src/components/ui/primitives';
import type { OneOnOnePrepSheet, OneOnOneSession } from '../../../../../src/lib/types';

/**
 * UL-10 1on1実施（本番中／事後まとめの2タブ、Phase4 9.3節）。
 * notesはUL自身の記録(user_stated)であり、AIが最終判断を下すことはない
 * （<one_on_one>要件の実装。事後まとめのnotesがそのままOneOnOneSession.notesとして保存され、
 * 本人にも実施後は閲覧可能になる）。
 */
export default function UlLiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<'live' | 'summary'>('live');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sessions = useQuery({ queryKey: ['one-on-one', 'sessions', 'me'], queryFn: () => api.get<OneOnOneSession[]>('/one-on-one/sessions/me') });
  const session = sessions.data?.find((s) => s.id === id);
  const prep = useQuery({
    queryKey: ['one-on-one', 'prep-sheet', session?.prepSheetId],
    queryFn: () => api.get<OneOnOnePrepSheet>(`/one-on-one/prep-sheets/${session?.prepSheetId}`),
    enabled: !!session?.prepSheetId,
  });

  const complete = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/one-on-one/sessions/${id}/complete`, { notes });
      router.push('/ul');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '確定できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (sessions.isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="1on1実施" />
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('live')}
          className={`px-3 py-2 text-sm ${tab === 'live' ? 'border-b-2 border-slate-900 font-medium text-slate-900' : 'text-slate-500'}`}
        >
          本番中
        </button>
        <button
          onClick={() => setTab('summary')}
          className={`px-3 py-2 text-sm ${tab === 'summary' ? 'border-b-2 border-slate-900 font-medium text-slate-900' : 'text-slate-500'}`}
        >
          事後まとめ
        </button>
      </div>

      {tab === 'live' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <p className="mb-2 text-sm font-semibold text-slate-700">準備内容（閲覧専用）</p>
            {prep.data ? (
              <div className="flex flex-col gap-3 text-sm text-slate-700">
                <p>{prep.data.changesSummary}</p>
                <ul className="flex flex-col gap-1">
                  {prep.data.recommendedQuestions.map((q, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <input type="checkbox" className="h-3.5 w-3.5" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-400">準備シートがありません</p>
            )}
          </Card>
          <Card>
            <p className="mb-2 text-sm font-semibold text-slate-700">ライブメモ</p>
            <Textarea rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="1on1中に気づいたことを記録してください" />
            <Button className="mt-3" onClick={() => setTab('summary')}>
              1on1を終了する
            </Button>
          </Card>
        </div>
      ) : (
        <Card className="max-w-lg">
          <p className="mb-2 text-sm font-semibold text-slate-700">事後サマリー（本人にも共有されます）</p>
          <Textarea rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="実施内容・次回への申し送りを記録してください" />
          {error && (
            <div className="mt-3">
              <ErrorBanner message={error} />
            </div>
          )}
          <Button className="mt-3" onClick={() => void complete()} disabled={pending || notes.trim().length === 0}>
            {pending ? '確定中…' : '確定して共有する'}
          </Button>
        </Card>
      )}
    </div>
  );
}
