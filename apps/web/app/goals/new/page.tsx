'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '../../../src/components/nav/app-shell';
import { api, ApiError } from '../../../src/lib/api-client';
import { Button, Card, ErrorBanner, Input, Label, PageHeader, Textarea } from '../../../src/components/ui/primitives';
import type { LongTermGoal } from '../../../src/lib/types';

/**
 * MEM-08 目標作成ウィザード。Phase4 7章の2経路のうち、まず「すでに目標がある」
 * ショートカット経路（3クリック以内、7.3節）を実装する。「自己理解からじっくり」経路は
 * 既存のMEM-02〜05（自己分析/夢/Why）への導線として提供し、そこから目標一覧の
 * ＋新しい目標で本画面に合流する構成とする。
 */
export default function NewGoalPage() {
  return (
    <RequireAuth>
      <Wizard />
    </RequireAuth>
  );
}

function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState<'choice' | 'form'>('choice');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (step === 'choice') {
    return (
      <div>
        <PageHeader title="＋新しい目標" description="どちらから始めますか？" />
        <div className="grid gap-4 sm:grid-cols-2">
          <a href="/self-analysis">
            <Card className="h-full cursor-pointer transition hover:border-slate-400">
              <p className="font-medium">自己理解からじっくり考えたい</p>
              <p className="mt-1 text-sm text-slate-500">約15分。自己分析・夢・Whyを深掘りしてから目標を作ります。</p>
            </Card>
          </a>
          <button onClick={() => setStep('form')} className="text-left">
            <Card className="h-full cursor-pointer transition hover:border-slate-400">
              <p className="font-medium">すでに目標がある（早く登録したい）</p>
              <p className="mt-1 text-sm text-slate-500">約3分。通過点を直接入力して登録します。</p>
            </Card>
          </button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const goal = await api.post<LongTermGoal>('/long-term-goals', {
        title,
        description: description || undefined,
        targetDate: targetDate || undefined,
      });
      router.push(`/goals/${goal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成できませんでした');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <PageHeader title="目標を登録" description="タイトルと期限を入力してください。この後、KPI接続とSMARTチェックに進みます。" />
      <Card className="max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">目標タイトル</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: AWS認定ソリューションアーキテクトを取得する" />
          </div>
          <div>
            <Label htmlFor="description">補足（任意）</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="targetDate">期限（任意）</Label>
            <Input id="targetDate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          {error && <ErrorBanner message={error} />}
          <Button type="submit" disabled={pending || title.trim().length === 0}>
            {pending ? '登録中…' : '登録する'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
