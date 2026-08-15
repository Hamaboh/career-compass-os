'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api-client';
import { Card, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import type { Employee, Invitation, Unit } from '../../src/lib/types';

/** ADM-01 管理者ダッシュボード。全社（全Unit）の運用状況を俯瞰する。 */
export default function AdminDashboardPage() {
  const employees = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const units = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });
  const invitations = useQuery({ queryKey: ['invitations'], queryFn: () => api.get<Invitation[]>('/invitations') });

  if (employees.isLoading) return <LoadingBlock />;

  const pendingInvitations = (invitations.data ?? []).filter((i) => i.status === 'pending' || i.status === 'opened').length;

  return (
    <div>
      <PageHeader title="管理者ダッシュボード" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/employees">
          <Card className="cursor-pointer transition hover:border-slate-400">
            <p className="text-xs font-medium text-slate-500">社員数</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{employees.data?.length ?? 0}名</p>
          </Card>
        </Link>
        <Link href="/admin/units">
          <Card className="cursor-pointer transition hover:border-slate-400">
            <p className="text-xs font-medium text-slate-500">Unit数</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{units.data?.length ?? 0}</p>
          </Card>
        </Link>
        <Link href="/admin/invitations">
          <Card className="cursor-pointer transition hover:border-slate-400">
            <p className="text-xs font-medium text-slate-500">未完了の招待</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{pendingInvitations}件</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
