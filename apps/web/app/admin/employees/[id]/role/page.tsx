'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, PageHeader, Select } from '../../../../../src/components/ui/primitives';
import type { EmployeeRole } from '@career-compass/shared';
import type { Employee } from '../../../../../src/lib/types';

/** ADM-04 権限管理。ロール変更（USER_ROLE_MANAGE）。 */
export default function AdminRolePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const employee = useQuery({ queryKey: ['employees', id], queryFn: () => api.get<Employee>(`/employees/${id}`) });
  const [role, setRole] = useState<EmployeeRole | ''>('');
  const currentRole = role || employee.data?.role || '';

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.patch(`/employees/${id}/role`, { role: currentRole });
      router.push('/admin/employees');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '変更できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (!employee.data) return null;

  return (
    <div>
      <PageHeader title="権限管理" description={employee.data.name} />
      <Card className="max-w-sm">
        <Select value={currentRole} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
          <option value="MEMBER">MEMBER</option>
          <option value="UL">UL</option>
          <option value="ADMIN">ADMIN</option>
          <option value="EXCLUDED">EXCLUDED</option>
        </Select>
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} />
          </div>
        )}
        <Button className="mt-3" onClick={() => void submit()} disabled={pending}>
          {pending ? '変更中…' : '変更する'}
        </Button>
      </Card>
    </div>
  );
}
