'use client';

import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api } from '../../src/lib/api-client';
import { Card, EmptyState, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import { formatDate } from '../../src/lib/labels';
import type { LongTermGoal, Vision, WhyRecord } from '../../src/lib/types';

const SUBJECT_LABELS: Record<string, string> = { vision: '夢・将来像', direction: 'キャリア方向', long_term_goal: '目標', checkpoint: '通過点' };

/**
 * MEM-05 Why。Phase4「自分の全WhyRecordを横断的に閲覧」。
 * GET /why-records は対象(subjectType/subjectId)ごとの取得のみをサポートするため、
 * 本人のVision/LongTermGoalを起点に集約して横断表示する（フロント側の合成、バックエンド
 * APIの追加変更は行わない設計判断）。
 */
export default function WhyPage() {
  return (
    <RequireAuth>
      <WhyOverview />
    </RequireAuth>
  );
}

function WhyOverview() {
  const visions = useQuery({ queryKey: ['visions'], queryFn: () => api.get<Vision[]>('/visions') });
  const goals = useQuery({ queryKey: ['long-term-goals'], queryFn: () => api.get<LongTermGoal[]>('/long-term-goals') });

  const subjects = [
    ...(visions.data ?? []).map((v) => ({ subjectType: 'vision', subjectId: v.id, label: v.content })),
    ...(goals.data ?? []).map((g) => ({ subjectType: 'long_term_goal', subjectId: g.id, label: g.title })),
  ];

  const whyQueries = useQuery({
    queryKey: ['why-records', subjects.map((s) => s.subjectId)],
    queryFn: async () => {
      const results = await Promise.all(
        subjects.map((s) =>
          api
            .get<WhyRecord[]>(`/why-records?subjectType=${s.subjectType}&subjectId=${s.subjectId}`)
            .then((records) => ({ subject: s, records })),
        ),
      );
      return results;
    },
    enabled: !visions.isLoading && !goals.isLoading,
  });

  if (visions.isLoading || goals.isLoading || whyQueries.isLoading) return <LoadingBlock />;

  const groups = (whyQueries.data ?? []).filter((g) => g.records.length > 0);

  return (
    <div>
      <PageHeader title="Why" description="なぜそれを目指すのか。あなた自身の言葉の記録です。" />
      {groups.length === 0 ? (
        <EmptyState title="まだWhyの記録がありません" description="目標や夢を深掘りするとここに表示されます。" />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Card key={g.subject.subjectId}>
              <p className="text-xs font-medium text-slate-400">{SUBJECT_LABELS[g.subject.subjectType]}: {g.subject.label}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {g.records.map((r) => (
                  <li key={r.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                    <p className="text-slate-800">{r.userText}</p>
                    <p className="mt-0.5 text-xs text-slate-400">深さ Lv.{r.depthLevel} ・ {formatDate(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
