'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api, ApiError } from '../../src/lib/api-client';
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, PageHeader, Textarea } from '../../src/components/ui/primitives';
import { AiProposalCard } from '../../src/components/shared/ai-proposal-card';
import type { DreamHypothesis } from '../../src/lib/types';

/** MEM-04 夢・将来像。Phase4 12.1節: 夢が明確でない人にも「仮説」を安心して持たせ、確定を急がせない。 */
export default function DreamsPage() {
  return (
    <RequireAuth>
      <DreamsFlow />
    </RequireAuth>
  );
}

function DreamsFlow() {
  const { data, isLoading } = useQuery({ queryKey: ['dream-hypotheses'], queryFn: () => api.get<DreamHypothesis[]>('/dream-hypotheses') });
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const generate = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post('/dream-hypotheses');
      await qc.invalidateQueries({ queryKey: ['dream-hypotheses'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '生成できませんでした');
    } finally {
      setPending(false);
    }
  };

  const react = async (id: string, reaction: 'agree' | 'partially_agree' | 'disagree', adjustedText?: string) => {
    setError(null);
    try {
      await api.post(`/dream-hypotheses/${id}/react`, { reaction, adjustedText });
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ['dream-hypotheses'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新できませんでした');
    }
  };

  const promote = async (id: string) => {
    setError(null);
    try {
      await api.post(`/dream-hypotheses/${id}/promote-to-vision`, {});
      await qc.invalidateQueries({ queryKey: ['dream-hypotheses'] });
      await qc.invalidateQueries({ queryKey: ['visions'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '昇格できませんでした');
    }
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="夢・将来像" description="仮説のままでも大丈夫です。しっくりくるものが見つかったら「これが将来像だと思う」を選んでください。" />
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <Button onClick={() => void generate()} disabled={pending} className="mb-4">
        {pending ? '生成中…' : '夢の仮説を生成する'}
      </Button>
      {!data || data.length === 0 ? (
        <EmptyState title="まだ夢の仮説がありません" description="自己分析のインサイトが増えると生成しやすくなります。" />
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((h) => (
            <Card key={h.id}>
              {h.linkedVisionId ? (
                <p className="whitespace-pre-wrap text-sm text-slate-800">{h.hypothesisText}</p>
              ) : (
                <>
                  <AiProposalCard
                    text={h.hypothesisText}
                    onAgree={() => void react(h.id, 'agree')}
                    onSlightlyDifferent={() => setEditingId(h.id)}
                    onDisagree={() => void react(h.id, 'disagree')}
                  />
                  {editingId === h.id && (
                    <div className="mt-2 flex flex-col gap-2">
                      <Textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                      <Button onClick={() => void react(h.id, 'partially_agree', editText)} disabled={editText.trim().length === 0}>
                        この内容で保存
                      </Button>
                    </div>
                  )}
                  {h.userReaction === 'agree' && (
                    <Button variant="secondary" className="mt-3" onClick={() => void promote(h.id)}>
                      これが将来像だと思う
                    </Button>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
