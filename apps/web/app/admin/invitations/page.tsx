'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../src/lib/api-client';
import { Badge, EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { formatDateTime } from '../../../src/lib/labels';
import { useState } from 'react';
import type { Invitation } from '../../../src/lib/types';

const STATUS_LABELS: Record<string, string> = {
  pending: '送信済み',
  opened: '開封済み',
  otp_verified: '本人確認済み',
  activated: '完了',
  expired: '期限切れ',
  revoked: '失効',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  opened: 'bg-amber-100 text-amber-700',
  otp_verified: 'bg-violet-100 text-violet-700',
  activated: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-slate-100 text-slate-500',
  revoked: 'bg-red-100 text-red-600',
};

/** ADM-05 招待管理。招待の発行・再送・失効・状況確認。 */
export default function AdminInvitationsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['invitations'], queryFn: () => api.get<Invitation[]>('/invitations') });

  const revoke = async (id: string) => {
    setError(null);
    try {
      await api.post(`/invitations/${id}/revoke`);
      await qc.invalidateQueries({ queryKey: ['invitations'] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '失効できませんでした');
    }
  };

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="招待管理" description="新しい招待は社員管理画面から発行してください。" />
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {!data || data.length === 0 ? (
        <EmptyState title="まだ招待した社員がいません" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">対象社員</th>
                <th className="p-3">状態</th>
                <th className="p-3">有効期限</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100">
                  <td className="p-3 text-slate-800">
                    {inv.employee.name}（{inv.employee.email}）
                  </td>
                  <td className="p-3">
                    <Badge className={STATUS_COLORS[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
                  </td>
                  <td className="p-3 text-xs text-slate-400">{formatDateTime(inv.expiresAt)}</td>
                  <td className="p-3">
                    {(inv.status === 'pending' || inv.status === 'opened') && (
                      <button onClick={() => void revoke(inv.id)} className="text-xs text-red-600 underline">
                        失効させる
                      </button>
                    )}
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
