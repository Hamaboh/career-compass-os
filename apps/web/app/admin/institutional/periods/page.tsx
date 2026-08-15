'use client';

import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label, PageHeader, Select } from '../../../../src/components/ui/primitives';
import { EVALUATION_PERIOD_TYPES, type EvaluationPeriodType } from '@career-compass/shared';
import { formatDate } from '../../../../src/lib/labels';
import type { Competency, EvaluationPeriod, Position } from '../../../../src/lib/types';

/** ADM-06 人事評価制度管理。評価期間・能力・職位マスタの基礎設定。 */
export default function AdminPeriodsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PeriodsSection />
      <CompetenciesSection />
      <PositionsSection />
    </div>
  );
}

function PeriodsSection() {
  const qc = useQueryClient();
  const [id, setId] = useState('');
  const [periodType, setPeriodType] = useState<EvaluationPeriodType>('half_year');
  const [periodLabel, setPeriodLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const periods = useQuery({ queryKey: ['evaluation-periods'], queryFn: () => api.get<EvaluationPeriod[]>('/evaluation-periods') });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/evaluation-periods', { id, periodType, periodLabel, periodStartDate: start, periodEndDate: end });
      setId('');
      setPeriodLabel('');
      await qc.invalidateQueries({ queryKey: ['evaluation-periods'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <section>
      <PageHeader title="人事評価制度管理" description="評価期間マスタ" />
      <Card className="mb-4 max-w-2xl">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>期間ID（例: FY2026-H1）</Label>
            <Input required value={id} onChange={(e) => setId(e.target.value)} />
          </div>
          <div>
            <Label>表示名</Label>
            <Input required value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="2026年度上期" />
          </div>
          <div>
            <Label>種別</Label>
            <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as EvaluationPeriodType)}>
              {EVALUATION_PERIOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>開始日</Label>
              <Input type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>終了日</Label>
              <Input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="sm:col-span-2">
              <ErrorBanner message={error} />
            </div>
          )}
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            {pending ? '作成中…' : '評価期間を追加'}
          </Button>
        </form>
      </Card>
      <div className="flex flex-wrap gap-2">
        {periods.data?.map((p) => (
          <span key={p.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {p.periodLabel}（{formatDate(p.periodStartDate)}〜{formatDate(p.periodEndDate)}）
          </span>
        ))}
      </div>
    </section>
  );
}

function CompetenciesSection() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const competencies = useQuery({ queryKey: ['competency-master'], queryFn: () => api.get<Competency[]>('/competency-master') });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/competency-master', { competencyName: name });
      setName('');
      await qc.invalidateQueries({ queryKey: ['competency-master'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    }
  };

  return (
    <section>
      <p className="mb-3 text-sm font-semibold text-slate-700">能力マスタ</p>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <Input placeholder="新しい能力名" required value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">追加</Button>
      </form>
      {error && <ErrorBanner message={error} />}
      <div className="flex flex-wrap gap-2">
        {competencies.data?.map((c) => (
          <span key={c.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            {c.competencyName}
          </span>
        ))}
      </div>
    </section>
  );
}

function PositionsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const positions = useQuery({ queryKey: ['position-master'], queryFn: () => api.get<Position[]>('/position-master') });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/position-master', { positionName: name, positionLevel: level });
      setName('');
      await qc.invalidateQueries({ queryKey: ['position-master'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    }
  };

  return (
    <section>
      <p className="mb-3 text-sm font-semibold text-slate-700">職位マスタ</p>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <Input placeholder="職位名" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" className="w-24" min={0} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        <Button type="submit">追加</Button>
      </form>
      {error && <ErrorBanner message={error} />}
      <div className="flex flex-wrap gap-2">
        {positions.data
          ?.sort((a, b) => a.positionLevel - b.positionLevel)
          .map((p) => (
            <span key={p.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              {p.positionName}（Lv.{p.positionLevel}）
            </span>
          ))}
      </div>
    </section>
  );
}
