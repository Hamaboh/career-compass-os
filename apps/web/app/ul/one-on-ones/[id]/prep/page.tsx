'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, LoadingBlock, PageHeader } from '../../../../../src/components/ui/primitives';
import { formatDateTime } from '../../../../../src/lib/labels';
import type { OneOnOnePrepSheet } from '../../../../../src/lib/types';

type Tab = 'summary' | 'questions' | 'revisions' | 'actions';

/**
 * UL-05〜08 1on1準備（1画面、タブ統合、Phase4 9.1/9.2節）。
 * 「未レビュー」バッジは常に画面上部に固定し、「この内容でレビュー完了にする」を押すまでは
 * UL-10（1on1実施）への遷移導線を出さない（本番に未レビューのまま突入することを防ぐ）。
 */
export default function UlPrepSheetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('summary');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: sheet, isLoading } = useQuery({
    queryKey: ['one-on-one', 'prep-sheet', id],
    queryFn: () => api.get<OneOnOnePrepSheet>(`/one-on-one/prep-sheets/${id}`),
  });

  const markReviewed = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/one-on-one/prep-sheets/${id}/mark-reviewed`);
      await qc.invalidateQueries({ queryKey: ['one-on-one', 'prep-sheet', id] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '処理できませんでした');
    } finally {
      setPending(false);
    }
  };

  const startSession = async () => {
    setPending(true);
    setError(null);
    try {
      const session = await api.post<{ id: string }>('/one-on-one/sessions', { employeeId: sheet?.employeeId, prepSheetId: id });
      router.push(`/ul/one-on-ones/${session.id}/live`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '開始できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (isLoading || !sheet) return <LoadingBlock />;

  const reviewed = !!sheet.reviewedByUlAt;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageHeader title="1on1準備" description={`生成日時: ${formatDateTime(sheet.generatedAt)}`} />
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${reviewed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {reviewed ? 'レビュー済み' : '未レビュー'}
        </span>
      </div>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(
          [
            ['summary', '変化サマリー'],
            ['questions', '推奨質問'],
            ['revisions', '目標修正提案'],
            ['actions', '課題・次アクション'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm ${tab === key ? 'border-b-2 border-slate-900 font-medium text-slate-900' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="flex flex-col gap-3">
          <Card>
            <p className="mb-1 text-xs font-medium text-slate-400">① 前回からの変化</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.changesSummary}</p>
          </Card>
          <Card>
            <p className="mb-1 text-xs font-medium text-slate-400">目標進捗</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.goalProgressSummary}</p>
          </Card>
          <Card>
            <p className="mb-1 text-xs font-medium text-slate-400">現場状況</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.fieldContextSummary || '特になし'}</p>
          </Card>
          <Card>
            <p className="mb-1 text-xs font-medium text-slate-400">成果</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.achievementsSummary}</p>
          </Card>
        </div>
      )}

      {tab === 'questions' && (
        <Card>
          <p className="mb-2 text-xs font-medium text-slate-400">② 聞くとよいこと（AI提案・参考）</p>
          {sheet.recommendedQuestions.length === 0 ? (
            <p className="text-sm text-slate-400">提案はありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sheet.recommendedQuestions.map((q, i) => (
                <li key={i} className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-800">
                  ✨ {q}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'revisions' && (
        <Card>
          <p className="mb-2 text-xs font-medium text-slate-400">④ 目標修正の要否</p>
          {sheet.goalRevisionCandidates.length === 0 ? (
            <p className="text-sm text-slate-400">提案はありません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sheet.goalRevisionCandidates.map((c, i) => (
                <li key={i} className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-800">
                  💡 {c}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-400">実際の目標修正はメンバー自身の確認・承認を経て初めて反映されます。</p>
        </Card>
      )}

      {tab === 'actions' && (
        <div className="flex flex-col gap-3">
          <Card>
            <p className="mb-2 text-xs font-medium text-slate-400">③ 気になる点</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.issuesSummary || '特になし'}</p>
          </Card>
          <Card>
            <p className="mb-2 text-xs font-medium text-slate-400">⑤ 次アクション候補</p>
            {sheet.nextActionCandidates.length === 0 ? (
              <p className="text-sm text-slate-400">提案はありません</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sheet.nextActionCandidates.map((a, i) => (
                  <li key={i} className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-slate-800">
                    ✨ {a}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <p className="mb-1 text-xs font-medium text-slate-400">未完了の行動</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{sheet.incompleteActionsSummary || 'なし'}</p>
          </Card>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {!reviewed ? (
          <Button onClick={() => void markReviewed()} disabled={pending}>
            {pending ? '処理中…' : 'この内容でレビュー完了にする'}
          </Button>
        ) : (
          <Button onClick={() => void startSession()} disabled={pending}>
            {pending ? '開始中…' : '1on1を開始する'}
          </Button>
        )}
      </div>
    </div>
  );
}
