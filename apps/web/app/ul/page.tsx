'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api-client';
import { Card, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import { formatDateTime } from '../../src/lib/labels';
import type { Employee, OneOnOneSession } from '../../src/lib/types';

/**
 * UL-01 ULダッシュボード。Phase4 11.1節: 対応が必要な事項→俯瞰情報の順で並べる
 * （要対応バッジ・直近1on1スケジュール・Unit全体サマリー）。
 */
export default function UlDashboardPage() {
  const members = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const sessions = useQuery({ queryKey: ['one-on-one', 'sessions', 'me'], queryFn: () => api.get<OneOnOneSession[]>('/one-on-one/sessions/me') });

  if (members.isLoading) return <LoadingBlock />;

  const memberCount = (members.data ?? []).filter((m) => m.role === 'MEMBER').length;
  const upcoming = (sessions.data ?? []).filter((s) => s.status === 'scheduled');

  return (
    <div>
      <PageHeader title="ULダッシュボード" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium text-slate-500">自Unitメンバー</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{memberCount}名</p>
          <Link href="/ul/members" className="mt-2 inline-block text-sm text-slate-600 underline">
            メンバー一覧を見る
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">次回1on1</p>
          {upcoming.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">予定なし</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {upcoming.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <Link href={`/ul/one-on-ones/${s.id}/prep`} className="text-sm text-slate-700 underline">
                    {formatDateTime(s.scheduledAt)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Link href="/ul/goals">
          <Card className="cursor-pointer transition hover:border-slate-400">
            <p className="text-sm font-medium text-slate-800">目標状況を見る</p>
          </Card>
        </Link>
        <Link href="/ul/unit-status">
          <Card className="cursor-pointer transition hover:border-slate-400">
            <p className="text-sm font-medium text-slate-800">Unit状況を見る</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
