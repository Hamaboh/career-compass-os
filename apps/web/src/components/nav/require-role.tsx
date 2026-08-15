'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { EmployeeRole } from '@career-compass/shared';
import { useAuth } from '../../lib/auth-context';
import { LoadingBlock } from '../ui/primitives';

/**
 * Phase4 14.3節「権限不足によるアクセス試行は、そもそも導線を出さないことを一次防御とし、
 * 直接URL遷移等の二次防御として403画面を用意する」。実際の認可は常にサーバー側のAPIが
 * 行う(Phase3 16.10節)ため、これは「権限のない画面の骨組みが一瞬見えてから弾かれる」という
 * 体験を避けるためのUX上の配慮に過ぎない。
 */
export function RequireRole({ roles, children }: { roles: EmployeeRole[]; children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session && !roles.includes(session.role)) {
      router.replace('/403');
    }
  }, [loading, session, roles, router]);

  if (loading || !session) return <LoadingBlock />;
  if (!roles.includes(session.role)) return <LoadingBlock />;
  return <>{children}</>;
}
