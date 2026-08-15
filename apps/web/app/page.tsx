'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../src/components/nav/app-shell';
import { api } from '../src/lib/api-client';
import { Button, Card, EmptyState, LoadingBlock, PageHeader } from '../src/components/ui/primitives';
import { StatusBadge } from '../src/components/shared/status-badge';
import { formatDate, NOTIFICATION_TYPE_ICONS, NOTIFICATION_TYPE_LABELS } from '../src/lib/labels';
import type { Action, AppNotification, LongTermGoal, OneOnOneSession, Vision } from '../src/lib/types';

/**
 * MEM-01 ダッシュボード。Phase4 12.1節「開いた瞬間に今日/今週やることが1つだけ分かる状態」を
 * 目指し、最初のActionを最上部に大きく表示する。まだ何もない場合は15章のEmpty State
 * （対等な2つの入口カード、23.5 U2の修正どおり同じ大きさで並べる）を出す。
 */
export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const visions = useQuery({ queryKey: ['visions'], queryFn: () => api.get<Vision[]>('/visions') });
  const goals = useQuery({ queryKey: ['long-term-goals'], queryFn: () => api.get<LongTermGoal[]>('/long-term-goals') });
  // GET /actions は longTermGoalId または checkpointId のいずれかを必須とする設計
  // （assertOwnsSubject、他ユーザーのActionを横断的に取得できないようにする境界）のため、
  // 「自分の全Action」はダッシュボード側で目標→通過点の順にfan-outして合成する。
  const actions = useQuery({
    queryKey: ['actions', 'dashboard', goals.data?.map((g) => g.id)],
    queryFn: async () => {
      const perGoal = await Promise.all(
        (goals.data ?? []).map((g) => api.get<Action[]>(`/actions?longTermGoalId=${g.id}`).catch(() => [])),
      );
      const checkpointLists = await Promise.all(
        (goals.data ?? []).map((g) => api.get<{ id: string }[]>(`/long-term-goals/${g.id}/checkpoints`).catch(() => [])),
      );
      const checkpointIds = checkpointLists.flat().map((c) => c.id);
      const perCheckpoint = await Promise.all(
        checkpointIds.map((id) => api.get<Action[]>(`/actions?checkpointId=${id}`).catch(() => [])),
      );
      return [...perGoal.flat(), ...perCheckpoint.flat()];
    },
    enabled: !goals.isLoading,
  });
  const notifications = useQuery({
    queryKey: ['notifications', 'unread-only'],
    queryFn: () => api.get<AppNotification[]>('/notifications?unreadOnly=true'),
  });
  const sessions = useQuery({ queryKey: ['one-on-one', 'me'], queryFn: () => api.get<OneOnOneSession[]>('/one-on-one/sessions/me') });

  if (visions.isLoading || goals.isLoading) return <LoadingBlock />;

  const hasAnything = (visions.data?.length ?? 0) > 0 || (goals.data?.length ?? 0) > 0;
  const activeGoal = goals.data?.find((g) => g.status === 'active' || g.status === 'confirmed');
  const nextAction = actions.data
    ?.filter((a) => a.status !== 'done')
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))[0];
  const latestSession = sessions.data?.[0];

  return (
    <div>
      <PageHeader title="ダッシュボード" />

      {!hasAnything ? (
        <div>
          <p className="mb-4 text-sm text-slate-600">あなたのキャリアを一緒に整理しましょう</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/self-analysis">
              <Card className="h-full cursor-pointer transition hover:border-slate-400">
                <p className="text-base font-medium">① 自己理解から始める</p>
                <p className="mt-1 text-sm text-slate-500">自己分析・夢・Whyをじっくり深掘りします（約15分）</p>
              </Card>
            </Link>
            <Link href="/goals/new">
              <Card className="h-full cursor-pointer transition hover:border-slate-400">
                <p className="text-base font-medium">② すでに目標がある</p>
                <p className="mt-1 text-sm text-slate-500">通過点を直接入力して素早く登録します（約3分）</p>
              </Card>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {nextAction && (
            <Card className="border-slate-900">
              <p className="text-xs font-medium text-slate-500">次のAction</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{nextAction.title}</p>
              {nextAction.dueDate && <p className="mt-1 text-sm text-slate-500">期限まであと{daysUntilLabel(nextAction.dueDate)}</p>}
            </Card>
          )}

          {visions.data && visions.data.length > 0 && (
            <Card>
              <p className="text-xs font-medium text-slate-500">あなたの将来像</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{visions.data[0].content}</p>
            </Card>
          )}

          {activeGoal && (
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">今向き合うべき目標</p>
                <StatusBadge status={activeGoal.status} />
              </div>
              <Link href={`/goals/${activeGoal.id}`} className="mt-1 block text-base font-medium text-slate-900 hover:underline">
                {activeGoal.title}
              </Link>
            </Card>
          )}

          {notifications.data && notifications.data.length > 0 && (
            <Card>
              <p className="mb-2 text-xs font-medium text-slate-500">要対応</p>
              <ul className="flex flex-col gap-2">
                {notifications.data.slice(0, 5).map((n) => (
                  <li key={n.id} className="flex items-start gap-2 text-sm">
                    <span>{NOTIFICATION_TYPE_ICONS[n.notificationType]}</span>
                    <span>
                      <span className="text-slate-400">[{NOTIFICATION_TYPE_LABELS[n.notificationType]}]</span> {n.title}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href="/notifications">
                <Button variant="ghost" className="mt-2">
                  すべての通知を見る
                </Button>
              </Link>
            </Card>
          )}

          {latestSession && (
            <Card>
              <p className="text-xs font-medium text-slate-500">直近の1on1</p>
              <p className="mt-1 text-sm text-slate-700">{latestSession.status === 'completed' ? '実施済み' : '予定あり'}</p>
              <Link href="/one-on-ones" className="mt-1 inline-block text-sm text-slate-600 underline">
                詳細を見る
              </Link>
            </Card>
          )}

          {!nextAction && !activeGoal && (
            <EmptyState title="まだ目標がありません" action={<Link href="/goals/new"><Button>＋新しい目標</Button></Link>} />
          )}
        </div>
      )}
    </div>
  );
}

function daysUntilLabel(dueDate: string): string {
  const diff = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (diff < 0) return `期限超過（${formatDate(dueDate)}）`;
  if (diff === 0) return '本日';
  return `${diff}日`;
}
