'use client';

import Link from 'next/link';
import { useAuth, defaultDashboardPath } from '../../src/lib/auth-context';
import { Card } from '../../src/components/ui/primitives';

/** Phase4 14.3節「権限エラー」。詳細な権限要件は表示せず、可能な操作への導線のみを示す。 */
export default function ForbiddenPage() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-sm text-center">
        <p className="text-2xl">🔒</p>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">この操作を行う権限がありません</h1>
        <Link
          href={session ? defaultDashboardPath(session.role) : '/login'}
          className="mt-4 inline-block text-sm text-slate-600 underline hover:text-slate-900"
        >
          ダッシュボードに戻る
        </Link>
      </Card>
    </div>
  );
}
