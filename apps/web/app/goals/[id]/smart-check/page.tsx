'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, PageHeader, Textarea } from '../../../../src/components/ui/primitives';
import { SmartCheckCards } from '../../../../src/components/shared/smart-check-cards';
import type { LongTermGoal } from '../../../../src/lib/types';

/**
 * MEM-09 SMARTチェック。Phase4 8章。確定前ゲート(<smart_gate>)そのものはサーバー側
 * (confirmLongTermGoal)で強制される。この画面はAIの指摘を材料に本人が目標文を磨く場であり、
 * AIが目標の可否を判定する画面だと誤解されないようにする。
 */
export default function SmartCheckPage() {
  return (
    <RequireAuth>
      <SmartCheck />
    </RequireAuth>
  );
}

function SmartCheck() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const goal = useQuery({ queryKey: ['long-term-goal', id], queryFn: () => api.get<LongTermGoal>(`/long-term-goals/${id}`) });

  const runAudit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/long-term-goals/${id}/smart-audit`);
      await qc.invalidateQueries({ queryKey: ['long-term-goal', id] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '監査を実行できませんでした');
    } finally {
      setPending(false);
    }
  };

  const confirm = async (withOverride: boolean) => {
    setPending(true);
    setError(null);
    try {
      await api.post(`/long-term-goals/${id}/confirm`, withOverride ? { smartOverrideReason: overrideReason } : {});
      router.push(`/goals/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SMART_AUDIT_INSUFFICIENT') {
        setShowOverride(true);
        setError(e.message);
      } else if (e instanceof ApiError && e.code === 'WHY_NOT_CONVINCING') {
        setError('目標を確定する前に、Whyをもう少し深掘りしてください（Why画面から続けられます）。');
      } else {
        setError(e instanceof ApiError ? e.message : '確定できませんでした');
      }
    } finally {
      setPending(false);
    }
  };

  if (goal.isLoading || !goal.data) return null;
  const g = goal.data;
  const audited = !!g.smartAuditedAt;
  const allOk = [g.smartSpecific, g.smartMeasurable, g.smartAchievable, g.smartRelevant, g.smartTimebound].every((v) => v === 'ok');

  return (
    <div>
      <PageHeader title="SMARTチェック" description={g.title} />
      <Card>
        {!audited ? (
          <div className="text-center">
            <p className="mb-3 text-sm text-slate-600">AIに目標の内容を確認してもらいましょう。</p>
            <Button onClick={() => void runAudit()} disabled={pending}>
              {pending ? '確認中…' : 'SMART監査を実行する'}
            </Button>
          </div>
        ) : (
          <>
            <SmartCheckCards
              specific={g.smartSpecific}
              measurable={g.smartMeasurable}
              achievable={g.smartAchievable}
              relevant={g.smartRelevant}
              timebound={g.smartTimebound}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => void runAudit()} variant="ghost" disabled={pending}>
                再監査する
              </Button>
              {allOk ? (
                <Button onClick={() => void confirm(false)} disabled={pending}>
                  {pending ? '確定中…' : 'この内容で確定する'}
                </Button>
              ) : (
                <Button onClick={() => setShowOverride(true)} variant="secondary" disabled={pending}>
                  不足のまま進む（要理由）
                </Button>
              )}
            </div>
            {showOverride && !allOk && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">不足のまま確定する理由を入力してください。</p>
                <Textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                <Button onClick={() => void confirm(true)} disabled={pending || overrideReason.trim().length === 0}>
                  理由を添えて確定する
                </Button>
              </div>
            )}
          </>
        )}
        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}
      </Card>
    </div>
  );
}
