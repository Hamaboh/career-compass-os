'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RequireAuth } from '../../../src/components/nav/app-shell';
import { api } from '../../../src/lib/api-client';
import { Card, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { formatDateTime } from '../../../src/lib/labels';
import type { OneOnOneSession } from '../../../src/lib/types';

/**
 * MEM-14 1on1詳細。実施後のサマリー・次アクション確認（本人視点）。
 * OneOnOneSession.notesはUL自身の記録(user_stated)であり、本人にも実施後は閲覧可能
 * （RLS: one_on_one_sessions_self_selectで透明性を確保、Phase3設計どおり）。
 */
export default function OneOnOneDetailPage() {
  return (
    <RequireAuth>
      <Detail />
    </RequireAuth>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['one-on-one', 'me'],
    queryFn: () => api.get<OneOnOneSession[]>('/one-on-one/sessions/me'),
  });

  if (isLoading) return <LoadingBlock />;
  const session = data?.find((s) => s.id === id);
  if (!session) return <p className="text-sm text-slate-500">1on1が見つかりません</p>;

  return (
    <div>
      <PageHeader title="1on1詳細" description={formatDateTime(session.scheduledAt ?? session.heldAt ?? session.createdAt)} />
      <Card>
        <p className="text-xs font-medium text-slate-400">ステータス</p>
        <p className="mb-3 text-sm text-slate-800">{session.status === 'completed' ? '実施済み' : session.status === 'cancelled' ? '中止' : '予定'}</p>
        {session.notes && (
          <>
            <p className="text-xs font-medium text-slate-400">サマリー</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{session.notes}</p>
          </>
        )}
      </Card>
    </div>
  );
}
