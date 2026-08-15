'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api-client';
import { Card, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { STATUS_LABELS } from '../../../src/lib/labels';
import type { Employee, LongTermGoal } from '../../../src/lib/types';
import type { GoalHierarchyStatus } from '@career-compass/shared';

/**
 * UL-09 Unit状況。Phase4 5章: 傾向のみの集計グラフ（生値非表示）、SMART例外件数。
 * 心理指標の生スコアはこの画面に一切含めない（Phase3 7.3節: UL/Adminは傾向集計のみ）。
 */
export default function UlUnitStatusPage() {
  const members = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const memberList = (members.data ?? []).filter((m) => m.role === 'MEMBER');

  const goals = useQuery({
    queryKey: ['long-term-goals', 'unit-status', memberList.map((m) => m.id)],
    queryFn: async () => {
      const lists = await Promise.all(memberList.map((m) => api.get<LongTermGoal[]>(`/long-term-goals?employeeId=${m.id}`)));
      return lists.flat();
    },
    enabled: !members.isLoading,
  });

  if (members.isLoading || goals.isLoading) return <LoadingBlock />;

  const statusCounts = (goals.data ?? []).reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = (acc[g.status] ?? 0) + 1;
    return acc;
  }, {});
  const smartExceptionCount = (goals.data ?? []).filter((g) => g.smartOverrideReason).length;

  return (
    <div>
      <PageHeader title="Unit状況" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="mb-3 text-sm font-semibold text-slate-700">目標ステータス分布</p>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <li key={status} className="flex justify-between">
                <span className="text-slate-600">{STATUS_LABELS[status as GoalHierarchyStatus] ?? status}</span>
                <span className="font-medium text-slate-900">{count}件</span>
              </li>
            ))}
            {Object.keys(statusCounts).length === 0 && <li className="text-slate-400">データがありません</li>}
          </ul>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-slate-700">SMART例外件数</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{smartExceptionCount}件</p>
          <p className="mt-1 text-xs text-slate-400">SMART不足のまま理由付きで確定された目標の件数</p>
        </Card>
      </div>
    </div>
  );
}
