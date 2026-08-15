'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '../../src/components/nav/require-role';
import { AdminShell } from '../../src/components/nav/admin-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
