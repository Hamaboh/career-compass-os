import type { InputRef } from "./schemas";

export type RedactionReport = {
  replacements: Record<string, number>;
  excludedRefs: Array<{ type: string; id: string; reason: string }>;
  warnings: string[];
  blocked: boolean;
};

const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phone =
  /(?:\+81[- ]?|(?<![A-Za-z0-9]))0\d{1,4}[- ]\d{1,4}[- ]\d{3,4}\b(?!-)/g;
const employeeId = /\b(?:EMP|社員(?:番号|ID))[-_: ]?[A-Z0-9-]{3,}\b/gi;
const exactDate = /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g;
const injection =
  /(以前|前)の指示を無視|ignore (all |the )?previous instructions?|秘密を(?:表示|出力)|system prompt/gi;
const unresolvedSpecific =
  /株式会社|有限会社|合同会社|顧客名[:：]|案件名[:：]|人事評価[:：]|住所[:：]|パスワード[:：]/g;

export function sanitizeContext(
  records: Array<{ ref: InputRef; label: string; text: string }>,
  known: {
    memberName: string;
    employeeRef: string;
    unitName: string;
    actorName: string;
    actorEmail: string;
  },
  excludedRefs: RedactionReport["excludedRefs"],
) {
  const report: RedactionReport = {
    replacements: {},
    excludedRefs,
    warnings: [],
    blocked: false,
  };
  const replace = (
    value: string,
    pattern: string | RegExp,
    replacement: string,
    kind: string,
  ) => {
    let count = 0;
    const effectivePattern =
      typeof pattern === "string"
        ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
        : pattern;
    const next = value.replace(effectivePattern, () => {
      count += 1;
      return replacement;
    });
    if (count)
      report.replacements[kind] = (report.replacements[kind] ?? 0) + count;
    return next;
  };
  const lines = records.map(({ ref, label, text }) => {
    let value = text;
    for (const [raw, replacement, kind] of [
      [known.memberName, "MEMBER_A", "PERSON"],
      [known.employeeRef, "MEMBER_ID", "EMPLOYEE_ID"],
      [known.unitName, "UNIT_A", "UNIT"],
      [known.actorName, "UL_A", "PERSON"],
      [known.actorEmail, "UL_CONTACT", "EMAIL"],
    ] as const)
      if (raw.trim()) value = replace(value, raw, replacement, kind);
    value = replace(value, email, "CONTACT_REDACTED", "EMAIL");
    value = replace(value, phone, "CONTACT_REDACTED", "PHONE");
    value = replace(value, employeeId, "MEMBER_ID", "EMPLOYEE_ID");
    value = replace(value, exactDate, "DATE_GENERALIZED", "EXACT_DATE");
    if (injection.test(value)) {
      injection.lastIndex = 0;
      report.warnings.push("PROMPT_INJECTION_DATA_EXCLUDED");
      value = replace(
        value,
        injection,
        "UNTRUSTED_INSTRUCTION_REMOVED",
        "PROMPT_INJECTION",
      );
    }
    injection.lastIndex = 0;
    if (unresolvedSpecific.test(value)) report.blocked = true;
    unresolvedSpecific.lastIndex = 0;
    return `[${ref.type}:${ref.id}] ${label}\n${value}`;
  });
  if (report.blocked)
    report.warnings.push("REIDENTIFICATION_RISK_REQUIRES_EDIT");
  return { sanitizedText: lines.join("\n\n"), report };
}

export function inspectSanitized(text: string) {
  const violations: string[] = [];
  if (email.test(text)) violations.push("PII_EMAIL");
  email.lastIndex = 0;
  if (phone.test(text)) violations.push("PII_PHONE");
  phone.lastIndex = 0;
  if (employeeId.test(text)) violations.push("PII_EMPLOYEE_ID");
  employeeId.lastIndex = 0;
  if (exactDate.test(text)) violations.push("EXACT_DATE");
  exactDate.lastIndex = 0;
  if (unresolvedSpecific.test(text)) violations.push("REIDENTIFICATION_RISK");
  unresolvedSpecific.lastIndex = 0;
  if (injection.test(text)) violations.push("PROMPT_INJECTION");
  injection.lastIndex = 0;
  return violations;
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
