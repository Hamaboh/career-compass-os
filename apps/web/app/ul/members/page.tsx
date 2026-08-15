'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api-client';
import { Card, EmptyState, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { useAuth } from '../../../src/lib/auth-context';

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: string;
  accountStatus: string;
}

/** UL-02 自Unitメンバー一覧。Phase4 5章: 生スコアは表示せず状態を横断的にスキャンできるカード。 */
export default function UlMembersPage() {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api.get<EmployeeRow[]>('/employees') });

  if (isLoading) return <LoadingBlock />;
  const members = (data ?? []).filter((e) => e.role === 'MEMBER' || (e.role === 'UL' && e.id !== session?.employeeId));

  return (
    <div>
      <PageHeader title="自Unitメンバー" />
      {members.length === 0 ? (
        <EmptyState title="メンバーがいません" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <Link key={m.id} href={`/ul/members/${m.id}`}>
              <Card className="cursor-pointer transition hover:border-slate-400">
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
