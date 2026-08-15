import { SMART_DIMENSION_LABELS } from '../../lib/labels';
import { isSmartAuditPassing } from '@career-compass/shared';

type SmartResult = 'ok' | 'needs_improvement' | 'insufficient' | null;

/** Phase4 8章「SMART UX」。5次元を独立したカードとして見せ、1つの合否バッジにまとめない。 */
export function SmartCheckCards({
  specific,
  measurable,
  achievable,
  relevant,
  timebound,
}: {
  specific: SmartResult;
  measurable: SmartResult;
  achievable: SmartResult;
  relevant: SmartResult;
  timebound: SmartResult;
}) {
  const dims: { key: keyof typeof SMART_DIMENSION_LABELS; value: SmartResult }[] = [
    { key: 'specific', value: specific },
    { key: 'measurable', value: measurable },
    { key: 'achievable', value: achievable },
    { key: 'relevant', value: relevant },
    { key: 'timebound', value: timebound },
  ];
  const passing = isSmartAuditPassing({
    specific: specific ?? undefined,
    measurable: measurable ?? undefined,
    achievable: achievable ?? undefined,
    relevant: relevant ?? undefined,
    timebound: timebound ?? undefined,
  });
  const okCount = dims.filter((d) => d.value === 'ok').length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {dims.map((d) => (
          <SmartCard key={d.key} label={SMART_DIMENSION_LABELS[d.key]} value={d.value} />
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {dims.every((d) => d.value === null)
          ? 'まだAIが判定していません。'
          : `5項目中${okCount}項目が充足しています。`}
        {passing && dims.some((d) => d.value !== null) && (
          <span className="ml-2 font-medium text-emerald-600">すべて充足しています</span>
        )}
      </p>
    </div>
  );
}

function SmartCard({ label, value }: { label: string; value: SmartResult }) {
  const style =
    value === 'ok'
      ? 'border-emerald-300 bg-emerald-50'
      : value === 'needs_improvement' || value === 'insufficient'
        ? 'border-amber-300 bg-amber-50'
        : 'border-dashed border-slate-300 bg-slate-50';
  const icon = value === 'ok' ? '✅' : value === 'needs_improvement' || value === 'insufficient' ? '⚠️' : '➖';
  const text = value === 'ok' ? '充足' : value === 'needs_improvement' ? '要改善' : value === 'insufficient' ? '不足' : '未評価';
  return (
    <div className={`rounded-lg border p-3 text-center ${style}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg">{icon}</p>
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  );
}
