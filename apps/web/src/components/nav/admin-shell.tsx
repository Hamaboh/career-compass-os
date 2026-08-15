'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Phase4 10.1節「管理機能のゾーニング」。「👤 人・組織」「⚙️ 制度・システム」の2グループに
 * 視覚的に分割する（現行RBACモデルではADMINが両ゾーンの権限を一律に持つため、
 * 権限による出し分けではなく可読性向上・将来のAdmin細分化への布石としての分割）。
 */
const ZONE_A = [
  { href: '/admin', label: '管理者ダッシュボード' },
  { href: '/admin/employees', label: '社員管理' },
  { href: '/admin/units', label: 'Unit管理' },
  { href: '/admin/invitations', label: '招待管理' },
];
const ZONE_B = [
  { href: '/admin/institutional/periods', label: '人事評価制度管理' },
  { href: '/admin/institutional/kpi', label: 'KPI管理' },
  { href: '/admin/institutional/ulm', label: 'Unit Leaders Mission管理' },
  { href: '/admin/settings/app', label: 'アプリ設定' },
];
const ZONE_OUTER = [{ href: '/admin/audit-logs', label: '監査ログ' }];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const linkClass = (href: string) =>
    `block rounded-lg px-3 py-2 text-sm ${pathname === href ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="shrink-0 md:w-56">
        <nav className="flex flex-col gap-4">
          <div>
            <p className="mb-1 px-3 text-xs font-semibold uppercase text-slate-400">👤 人・組織</p>
            <div className="flex flex-col gap-1">
              {ZONE_A.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 px-3 text-xs font-semibold uppercase text-slate-400">⚙️ 制度・システム</p>
            <div className="flex flex-col gap-1">
              {ZONE_B.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-3">
            {ZONE_OUTER.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
