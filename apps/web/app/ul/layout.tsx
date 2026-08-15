'use client';

import type { ReactNode } from 'react';
import { RequireRole } from '../../src/components/nav/require-role';
import { UlShell } from '../../src/components/nav/ul-shell';

export default function UlLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={['UL', 'ADMIN']}>
      <UlShell>{children}</UlShell>
    </RequireRole>
  );
}
