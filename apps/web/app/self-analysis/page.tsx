'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuth } from '../../src/components/nav/app-shell';
import { api, ApiError } from '../../src/lib/api-client';
import { Button, Card, ErrorBanner, PageHeader, Spinner, Textarea } from '../../src/components/ui/primitives';

interface NextQuestion {
  categoryCode: string;
  questionText: string;
  depthLevel: number;
}
interface StartResponse {
  session: { id: string; status: string };
  nextQuestion: NextQuestion;
}
interface AnswerResponse {
  nextQuestion: NextQuestion | null;
  insightGenerated: unknown;
  sessionStatus: string;
}

/**
 * MEM-02 自己分析（対話）。Phase4 6.1節「1問1答型」。次の質問は事前に用意されておらず、
 * 回答送信後にAIがその場で生成する（考え中…インジケータ）。
 * 「わからない/答えたくない」ボタンを常に同じ位置に表示しスキップに罪悪感を持たせない。
 */
export default function SelfAnalysisPage() {
  return (
    <RequireAuth>
      <SelfAnalysisFlow />
    </RequireAuth>
  );
}

function SelfAnalysisFlow() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<NextQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [answeredCount, setAnsweredCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await api.post<StartResponse>('/self-analysis/sessions');
      setSessionId(res.session.id);
      setQuestion(res.nextQuestion);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '開始できませんでした');
    } finally {
      setPending(false);
    }
  };

  const submit = async (isSkip: boolean) => {
    if (!sessionId || !question) return;
    setPending(true);
    setError(null);
    try {
      const res = await api.post<AnswerResponse>(`/self-analysis/sessions/${sessionId}/answers`, {
        categoryCode: question.categoryCode,
        questionText: question.questionText,
        depthLevel: question.depthLevel,
        rawText: isSkip ? undefined : answer,
        isSkip,
      });
      setAnswer('');
      setAnsweredCount((c) => c + 1);
      if (res.nextQuestion) {
        setQuestion(res.nextQuestion);
      } else {
        setDone(true);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '送信できませんでした');
    } finally {
      setPending(false);
    }
  };

  if (!sessionId) {
    return (
      <div>
        <PageHeader title="自己分析" description="いつ中断しても大丈夫です。少しずつ、あなたのことを聞かせてください。" />
        {error && <ErrorBanner message={error} />}
        <Button onClick={() => void start()} disabled={pending}>
          {pending ? '準備中…' : '自己分析を始める'}
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <PageHeader title="自己分析" />
        <Card>
          <p className="text-base font-medium">少しずつあなたのことがわかってきました。</p>
          <p className="mt-1 text-sm text-slate-500">ここまでの内容を確認しましょう。</p>
          <Button className="mt-4" onClick={() => router.push('/self-analysis/insights')}>
            インサイトを確認する
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="自己分析" description="少しずつあなたのことがわかってきました。" />
      <Card>
        {question ? (
          <>
            <p className={question.depthLevel > 0 ? 'ml-4 border-l-2 border-violet-200 pl-3 text-xs font-medium text-violet-500' : 'text-xs font-medium text-slate-400'}>
              {question.depthLevel > 0 ? 'もう少し詳しく' : `カテゴリ: ${question.categoryCode}`}
            </p>
            <p className="mt-2 text-base text-slate-900">{question.questionText}</p>
            <Textarea
              rows={4}
              className="mt-3"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="自由にお書きください"
            />
            {error && (
              <div className="mt-3">
                <ErrorBanner message={error} />
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={() => void submit(false)} disabled={pending || answer.trim().length === 0}>
                {pending ? <Spinner /> : '回答する'}
              </Button>
              <Button variant="ghost" onClick={() => void submit(true)} disabled={pending}>
                わからない/答えたくない
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">これまでに{answeredCount}件回答しました。自動保存済み。</p>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> 考え中…
          </div>
        )}
      </Card>
    </div>
  );
}
