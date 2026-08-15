'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const UL_LINKS = [
  { href: '/ul', label: 'ULダッシュボード' },
  { href: '/ul/members', label: '自Unitメンバー' },
  { href: '/ul/goals', label: '目標状況' },
  { href: '/ul/unit-status', label: 'Unit状況' },
];

/** Phase4 2.3節 UL-01〜09。UL-05〜10(1on1関連)はメンバー詳細からの導線で個別に遷移する。 */
export function UlShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <aside className="shrink-0 md:w-48">
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
          {UL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                pathname === l.href ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
