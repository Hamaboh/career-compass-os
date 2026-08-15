'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../../lib/auth-context';
import { LoadingBlock } from '../ui/primitives';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import type { AppNotification } from '../../lib/types';

/**
 * Phase4 1.1節「ロール別トップレベルナビゲーション」。
 * MemberNav(自分自身の領域)は全ロール共通で表示する。ULはこれに加えてUnit管理領域への、
 * ADMINは別コンソール(管理者ダッシュボード)への切替導線をヘッダーに持つ
 * （Phase4 13.3節「複数ロールを持つ場合は…明示的な切替スイッチをヘッダーに常設する」）。
 */
const MEMBER_LINKS = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/self-analysis', label: '自己分析' },
  { href: '/dreams', label: '夢・将来像' },
  { href: '/why', label: 'Why' },
  { href: '/goals', label: '目標' },
  { href: '/reflections', label: '振り返り' },
  { href: '/one-on-ones', label: '1on1' },
  { href: '/notifications', label: '通知' },
];

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !session) router.replace('/login');
  }, [loading, session, router]);

  if (loading) return <LoadingBlock />;
  if (!session) return <LoadingBlock />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const pathname = usePathname();
  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<AppNotification[]>('/notifications?unreadOnly=true'),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  const unreadCount = notifications?.length ?? 0;

  if (!session) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-slate-900">
              羅針盤キャリアOS
            </Link>
            <nav className="hidden gap-4 md:flex">
              {MEMBER_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm ${pathname === l.href ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {(session.role === 'UL' || session.role === 'ADMIN') && (
              <Link href="/ul" className="text-sm text-slate-500 hover:text-slate-800">
                👥 Unit管理
              </Link>
            )}
            {session.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">
                ⚙️ 管理コンソール
              </Link>
            )}
            <Link href="/notifications" className="relative text-sm text-slate-500 hover:text-slate-800">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="text-sm text-slate-500 hover:text-slate-800">
              プロフィール
            </Link>
            <button onClick={() => void logout()} className="text-sm text-slate-500 hover:text-slate-800">
              ログアウト
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
