'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label, PageHeader, Select } from '../../../src/components/ui/primitives';
import type { EmployeeRole } from '@career-compass/shared';
import type { Employee, Unit } from '../../../src/lib/types';

const STATUS_LABELS: Record<string, string> = { pending: '招待前', active: '有効', locked: 'ロック中', suspended: '停止中', deactivated: '退職済み' };

/** ADM-02 社員管理。社員情報のCRUD・在籍状態変更。 */
export default function AdminEmployeesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<EmployeeRole>('MEMBER');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const employees = useQuery({ queryKey: ['employees'], queryFn: () => api.get<Employee[]>('/employees') });
  const units = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });

  const createEmployee = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const employee = await api.post<Employee>('/employees', { email, name, role, unitId: unitId || undefined });
      await api.post('/invitations', { employeeId: employee.id });
      setEmail('');
      setName('');
      setShowCreate(false);
      await qc.invalidateQueries({ queryKey: ['employees'] });
      await qc.invalidateQueries({ queryKey: ['invitations'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  const changeStatus = async (id: string, accountStatus: 'active' | 'suspended' | 'deactivated') => {
    setError(null);
    try {
      await api.patch(`/employees/${id}/status`, { accountStatus });
      await qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '変更できませんでした');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageHeader title="社員管理" />
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? '閉じる' : '招待する'}</Button>
      </div>
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {showCreate && (
        <Card className="mb-4 max-w-lg">
          <form onSubmit={createEmployee} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="email">メールアドレス</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="name">氏名</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="role">ロール</Label>
              <Select id="role" value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
                <option value="MEMBER">MEMBER</option>
                <option value="UL">UL</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </div>
            {role === 'MEMBER' && (
              <div>
                <Label htmlFor="unit">所属Unit</Label>
                <Select id="unit" required value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">選択してください</option>
                  {units.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? '招待中…' : '社員を登録して招待する'}
            </Button>
          </form>
        </Card>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-3">氏名</th>
              <th className="p-3">メール</th>
              <th className="p-3">ロール</th>
              <th className="p-3">状態</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.data?.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="p-3 text-slate-800">{e.name}</td>
                <td className="p-3 text-slate-500">{e.email}</td>
                <td className="p-3">
                  <Link href={`/admin/employees/${e.id}/role`} className="text-slate-600 underline">
                    {e.role}
                  </Link>
                </td>
                <td className="p-3 text-slate-600">{STATUS_LABELS[e.accountStatus] ?? e.accountStatus}</td>
                <td className="p-3">
                  {e.accountStatus === 'active' ? (
                    <button onClick={() => void changeStatus(e.id, 'suspended')} className="text-xs text-red-600 underline">
                      停止
                    </button>
                  ) : e.accountStatus === 'suspended' ? (
                    <button onClick={() => void changeStatus(e.id, 'active')} className="text-xs text-emerald-600 underline">
                      再開
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
