'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api-client';
import { EmptyState, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { StatusBadge } from '../../../src/components/shared/status-badge';
import type { Employee, LongTermGoal } from '../../../src/lib/types';

/** UL-04 目標状況。Unit配下の全目標を状態別に俯瞰する。 */
export default function UlGoalsPage() {
  const members = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const memberList = (members.data ?? []).filter((m) => m.role === 'MEMBER');

  const goals = useQuery({
    queryKey: ['long-term-goals', 'unit', memberList.map((m) => m.id)],
    queryFn: async () => {
      const lists = await Promise.all(
        memberList.map((m) =>
          api.get<LongTermGoal[]>(`/long-term-goals?employeeId=${m.id}`).then((gs) => gs.map((g) => ({ ...g, memberName: m.name }))),
        ),
      );
      return lists.flat();
    },
    enabled: !members.isLoading,
  });

  if (members.isLoading || goals.isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="目標状況" />
      {!goals.data || goals.data.length === 0 ? (
        <EmptyState title="Unit内にまだ目標がありません" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">メンバー</th>
                <th className="p-3">目標</th>
                <th className="p-3">状態</th>
              </tr>
            </thead>
            <tbody>
              {goals.data.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-600">{g.memberName}</td>
                  <td className="p-3 text-slate-800">{g.title}</td>
                  <td className="p-3">
                    <StatusBadge status={g.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
