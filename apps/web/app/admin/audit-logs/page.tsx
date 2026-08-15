'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api-client';
import { EmptyState, LoadingBlock, PageHeader } from '../../../src/components/ui/primitives';
import { formatDateTime } from '../../../src/lib/labels';
import type { AuditLogEntry } from '../../../src/lib/types';

/**
 * ADM-11 監査ログ。Phase4 10.3節: 生ログの検索・閲覧のみ（集計・ランキング機能は実装しない）。
 * 行を開くとbefore/afterの差分をハイライト表示し、system(AI)操作と人間操作をアイコンで区別する。
 */
export default function AdminAuditLogsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs'], queryFn: () => api.get<AuditLogEntry[]>('/audit-logs?limit=100') });

  if (isLoading) return <LoadingBlock />;

  return (
    <div>
      <PageHeader title="監査ログ" />
      {!data || data.length === 0 ? (
        <EmptyState title="ログがありません" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3"></th>
                <th className="p-3">日時</th>
                <th className="p-3">操作</th>
                <th className="p-3">対象</th>
              </tr>
            </thead>
            <tbody>
              {data.map((log) => (
                <>
                  <tr key={log.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                    <td className="p-3">{log.actorType === 'system' ? '🤖' : '👤'}</td>
                    <td className="p-3 text-xs text-slate-400">{formatDateTime(log.createdAt)}</td>
                    <td className="p-3 font-mono text-xs text-slate-700">{log.action}</td>
                    <td className="p-3 text-xs text-slate-500">{log.targetType ?? '—'}</td>
                  </tr>
                  {expanded === log.id && (log.before || log.after) && (
                    <tr key={`${log.id}-detail`} className="border-t border-slate-100 bg-slate-50">
                      <td colSpan={4} className="p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-slate-400">変更前</p>
                            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-slate-600">
                              {JSON.stringify(log.before, null, 2) ?? 'なし'}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-400">変更後</p>
                            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-slate-600">
                              {JSON.stringify(log.after, null, 2) ?? 'なし'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
