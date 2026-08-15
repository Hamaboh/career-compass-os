import type { GoalHierarchyStatus } from '@career-compass/shared';
import { Badge } from '../ui/primitives';
import { STATUS_COLORS, STATUS_LABELS } from '../../lib/labels';

export function StatusBadge({ status }: { status: GoalHierarchyStatus }) {
  return <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>;
}

/** Phase4 6.3節: 本人以外(UL/Admin)には5段階ラベルすら出さず、傾向(矢印)のみを表示する。 */
export function TrendArrow({ trend }: { trend: 'up' | 'flat' | 'down' }) {
  const map = { up: { icon: '↗', color: 'text-emerald-600', label: '上昇' }, flat: { icon: '→', color: 'text-slate-500', label: '横ばい' }, down: { icon: '↘', color: 'text-orange-600', label: '低下' } };
  const t = map[trend];
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${t.color}`}>
      {t.icon} {t.label}
    </span>
  );
}
