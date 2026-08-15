'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, PageHeader, Select } from '../../../src/components/ui/primitives';
import type { Employee, Unit } from '../../../src/lib/types';

/** ADM-03 Unit管理。Unit作成・編集・主担当UL設定。 */
export default function AdminUnitsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [primaryUlEmployeeId, setPrimaryUlEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const units = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });
  const employees = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const uls = (employees.data ?? []).filter((e) => e.role === 'UL' || e.role === 'ADMIN');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/units', { name, primaryUlEmployeeId: primaryUlEmployeeId || undefined });
      setName('');
      setPrimaryUlEmployeeId('');
      await qc.invalidateQueries({ queryKey: ['units'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Unit管理" />
      <Card className="mb-4 max-w-lg">
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <Input placeholder="新しいUnit名" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Select className="w-48" value={primaryUlEmployeeId} onChange={(e) => setPrimaryUlEmployeeId(e.target.value)}>
            <option value="">主担当ULなし</option>
            {uls.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={pending}>
            作成
          </Button>
        </form>
        {error && (
          <div className="mt-2">
            <ErrorBanner message={error} />
          </div>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {units.data?.map((u) => (
          <Card key={u.id}>
            <p className="font-medium text-slate-900">{u.name}</p>
            <p className="mt-1 text-xs text-slate-400">
              主担当UL: {employees.data?.find((e) => e.id === u.primaryUlEmployeeId)?.name ?? '未設定'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
