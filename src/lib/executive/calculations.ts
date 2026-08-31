export const TURNOVER_RULE_VERSION = "2026-01-primary-active-v1";

export type TurnoverResult = {
  startCount: number;
  endCount: number;
  leaverCount: number;
  averageCount: number;
  rawRate: number | null;
  displayRate: number | null;
  calculable: boolean;
  isEightOrMore: boolean;
  ruleVersion: string;
  disclaimer: string;
};

export function calculateTurnover(
  startCount: number,
  endCount: number,
  leaverCount: number,
): TurnoverResult {
  for (const value of [startCount, endCount, leaverCount]) {
    if (!Number.isInteger(value) || value < 0)
      throw new Error("counts_must_be_non_negative_integers");
  }
  const averageCount = (startCount + endCount) / 2;
  const calculable = averageCount > 0;
  const rawRate = calculable ? (leaverCount / averageCount) * 100 : null;
  const displayRate =
    rawRate === null ? null : Math.floor((rawRate + Number.EPSILON) * 10) / 10;
  return {
    startCount,
    endCount,
    leaverCount,
    averageCount,
    rawRate,
    displayRate,
    calculable,
    isEightOrMore: averageCount >= 8,
    ruleVersion: TURNOVER_RULE_VERSION,
    disclaimer: "参考情報であり正式評価ではありません",
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function parseDate(value: string) {
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime()) || isoDate(date) !== value)
    throw new Error("invalid_date");
  return date;
}
export function secondBusinessDayOfFollowingMonth(
  targetMonth: string,
  holidays: ReadonlySet<string>,
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth))
    throw new Error("invalid_target_month");
  const [year, month] = targetMonth.split("-").map(Number);
  const cursor = new Date(Date.UTC(year!, month!, 1));
  let count = 0;
  while (count < 2) {
    const day = cursor.getUTCDay();
    const date = isoDate(cursor);
    if (day !== 0 && day !== 6 && !holidays.has(date)) count += 1;
    if (count < 2) cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return isoDate(cursor);
}

export type ResponseWindow = {
  contactAt: string;
  responseAt: string | null;
  referenceAt: string;
  thresholdAt: string;
  classification:
    | "WITHIN_24_HOURS"
    | "REFERENCE_EVENT"
    | "PENDING_BEFORE_THRESHOLD";
  referenceEvent: boolean;
  source: "UL_RECORDED_FACT";
  disclaimer: string;
};

export function classifyResponseWindow(
  contactAt: string,
  responseAt: string | null,
  referenceAt: string,
): ResponseWindow {
  const contact = new Date(contactAt);
  const response = responseAt ? new Date(responseAt) : null;
  const reference = new Date(referenceAt);
  if (
    [contact, reference, ...(response ? [response] : [])].some((d) =>
      Number.isNaN(d.getTime()),
    )
  )
    throw new Error("invalid_datetime");
  if (response && response < contact) throw new Error("response_before_contact");
  if (reference < contact) throw new Error("reference_before_contact");
  const threshold = new Date(contact.getTime() + 24 * 60 * 60 * 1000);
  const referenceEvent = response ? response >= threshold : reference >= threshold;
  return {
    contactAt: contact.toISOString(),
    responseAt: response?.toISOString() ?? null,
    referenceAt: reference.toISOString(),
    thresholdAt: threshold.toISOString(),
    classification: referenceEvent
      ? "REFERENCE_EVENT"
      : response
        ? "WITHIN_24_HOURS"
        : "PENDING_BEFORE_THRESHOLD",
    referenceEvent,
    source: "UL_RECORDED_FACT",
    disclaimer: "手入力された事実に基づく参考情報であり、正式評価ではありません",
  };
}
