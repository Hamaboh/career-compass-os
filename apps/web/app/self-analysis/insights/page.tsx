'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Textarea } from '../../../src/components/ui/primitives';
import { AiProposalCard } from '../../../src/components/shared/ai-proposal-card';
import { QUALITATIVE_LABELS } from '../../../src/lib/labels';
import type { PublicInsight } from '../../../src/lib/types';

/** MEM-03 自己分析ふりかえり。AI生成インサイトの確認・承認・修正（Phase4 6.2節のカード型）。 */
export default function InsightsPage() {
  return (
    <RequireAuth>
      <InsightsList />
    </RequireAuth>
  );
}

function InsightsList() {
  const { data, isLoading } = useQuery({ queryKey: ['self-analysis-insights'], queryFn: () => api.get<PublicInsight[]>('/self-analysis/insights') });
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const react = async (id: string, reaction: 'agree' | 'adjust' | 'reject', text?: string) => {
    setError(null);
    try {
      await api.post(`/self-analysis/insights/${id}/react`, { reaction, editText: text });
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['self-analysis-insights'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新できませんでした');
    }
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="自己分析ふりかえり" description="AIが気づいたことを提案します。ピンとこなければ書き直せます。" />
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {!data || data.length === 0 ? (
        <EmptyState title="まだインサイトがありません" description="自己分析を進めるとここに表示されます。" />
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((insight) => (
            <div key={insight.id}>
              <AiProposalCard
                text={insight.contentText}
                basis={insight.confidenceIndicator ? `確信度: ${QUALITATIVE_LABELS[insight.confidenceIndicator.label]}` : undefined}
                pending={editingId === insight.id}
                onAgree={insight.status === 'pending_review' || !insight.userApproved ? () => void react(insight.id, 'agree') : undefined}
                onSlightlyDifferent={() => setEditingId(insight.id)}
                onDisagree={() => void react(insight.id, 'reject')}
              />
              {editingId === insight.id && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                  <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="ご自身の言葉で書き直してください" />
                  <div className="flex gap-2">
                    <Button onClick={() => void react(insight.id, 'adjust', editText)} disabled={editText.trim().length === 0}>
                      この内容で保存
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
