'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api } from '../../src/lib/api-client';
import { Button, EmptyState, LoadingBlock, PageHeader } from '../../src/components/ui/primitives';
import { NOTIFICATION_TYPE_ICONS, NOTIFICATION_TYPE_LABELS, formatDateTime } from '../../src/lib/labels';
import type { AppNotification } from '../../src/lib/types';

/**
 * MEM-15 通知。Phase4 16.1節: 未読/既読ではなく「対応済み/未対応」を主軸にする
 * （通知を読んだかではなく行動につながったかを重視する設計）。各通知は該当画面へ1タップで遷移する。
 */
const LINK_MAP: Record<string, (relatedId: string | null) => string> = {
  action_due: () => '/goals',
  interim_check: () => '/goals',
  reflection_prompt: () => '/reflections',
  one_on_one_prep: () => '/one-on-ones',
  unanswered: () => '/self-analysis',
  smart_incomplete: (id) => (id ? `/goals/${id}/smart-check` : '/goals'),
  goal_deadline: (id) => (id ? `/goals/${id}` : '/goals'),
  goal_updated: (id) => (id ? `/goals/${id}` : '/goals'),
  ai_important_suggestion: (id) => (id ? `/goals/${id}` : '/goals'),
};

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsList />
    </RequireAuth>
  );
}

function NotificationsList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: () => api.get<AppNotification[]>(`/notifications${filter === 'unread' ? '?unreadOnly=true' : ''}`),
  });

  const openNotification = async (n: AppNotification) => {
    if (!n.readAt) {
      await api.patch(`/notifications/${n.id}/read`);
      await qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    const path = n.notificationType === 'goal_updated' || n.notificationType === 'goal_deadline' || n.notificationType === 'smart_incomplete' || n.notificationType === 'ai_important_suggestion'
      ? LINK_MAP[n.notificationType]?.(n.relatedType === 'long_term_goal' ? n.relatedId : null)
      : LINK_MAP[n.notificationType]?.(n.relatedId);
    router.push(path ?? '/');
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageHeader title="通知" />
        <div className="flex gap-2">
          <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>
            すべて
          </Button>
          <Button variant={filter === 'unread' ? 'secondary' : 'ghost'} onClick={() => setFilter('unread')}>
            未対応
          </Button>
          <Button variant="ghost" onClick={() => void markAllRead()}>
            すべて既読にする
          </Button>
        </div>
      </div>
      {!data || data.length === 0 ? (
        <EmptyState title="通知はありません" />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => void openNotification(n)}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:border-slate-400 ${
                  n.readAt ? 'border-slate-200 bg-white' : 'border-violet-200 bg-violet-50'
                }`}
              >
                <span className="text-lg">{NOTIFICATION_TYPE_ICONS[n.notificationType]}</span>
                <span className="flex-1">
                  <span className="block text-xs text-slate-400">{NOTIFICATION_TYPE_LABELS[n.notificationType]}</span>
                  <span className="block text-sm font-medium text-slate-800">{n.title}</span>
                  <span className="block text-sm text-slate-500">{n.body}</span>
                  <span className="mt-1 block text-xs text-slate-400">{formatDateTime(n.deliveredAt)}</span>
                </span>
                {!n.readAt && <span className="mt-1 h-2 w-2 rounded-full bg-violet-500" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
