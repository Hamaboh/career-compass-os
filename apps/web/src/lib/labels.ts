import type { GoalHierarchyStatus } from '@career-compass/shared';

/** Phase2 FOUNDATION §0.2の9値ステータス語彙 → 画面表示用の日本語ラベル・色分け。 */
export const STATUS_LABELS: Record<GoalHierarchyStatus, string> = {
  exploring: '探索中',
  provisional: '仮決め',
  confirmed: '確定',
  active: '進行中',
  stalled: '停滞',
  under_review: '見直し中',
  achieved: '達成',
  discontinued: '中止',
  archived: 'アーカイブ',
};

export const STATUS_COLORS: Record<GoalHierarchyStatus, string> = {
  exploring: 'bg-slate-100 text-slate-600',
  provisional: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  stalled: 'bg-orange-100 text-orange-700',
  under_review: 'bg-purple-100 text-purple-700',
  achieved: 'bg-emerald-600 text-white',
  discontinued: 'bg-slate-200 text-slate-500 line-through',
  archived: 'bg-slate-100 text-slate-400',
};

/** 5段階ラベル（Phase4 6.3節、心理指標の表示規約）。 */
export const QUALITATIVE_LABELS: Record<string, string> = {
  very_low: '非常に低い',
  low: '低い',
  medium: '中程度',
  high: '高い',
  very_high: '非常に高い',
};

export const ACTION_STATUS_LABELS: Record<string, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
  blocked: '手が止まっている',
};

export const REMINDER_TRIGGER_LABELS: Record<string, string> = {
  interim_check: '中間確認',
  deadline: '目標期限',
  reflection: '振り返り',
};

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  action_due: '行動予定',
  interim_check: '中間確認',
  reflection_prompt: '振り返り',
  one_on_one_prep: '1on1準備',
  unanswered: '未回答',
  smart_incomplete: 'SMART未完了',
  goal_deadline: '目標期限',
  goal_updated: '目標更新',
  ai_important_suggestion: 'AIからの重要な提案',
};

export const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  action_due: '📌',
  interim_check: '🔍',
  reflection_prompt: '📝',
  one_on_one_prep: '🗣️',
  unanswered: '❓',
  smart_incomplete: '🎯',
  goal_deadline: '⏰',
  goal_updated: '🔄',
  ai_important_suggestion: '✨',
};

export const SMART_DIMENSION_LABELS: Record<'specific' | 'measurable' | 'achievable' | 'relevant' | 'timebound', string> = {
  specific: 'S 具体的',
  measurable: 'M 測定可能',
  achievable: 'A 達成可能',
  relevant: 'R 関連性',
  timebound: 'T 期限',
};

export const SMART_RESULT_LABELS: Record<string, string> = {
  ok: '充足',
  needs_improvement: '要改善',
  insufficient: '不足',
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return '未設定';
  return new Date(value).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '未設定';
  return new Date(value).toLocaleString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
