import { Injectable } from '@nestjs/common';
import type { ActorType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 監査ログに書き込んではいけないフィールド名（<constraints>「パスワードやOTPをログ出力しない」、
 * Phase3 15.2節）。呼び出し側が誤って含めても、ここで機械的に落とす多層防御。
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'newPassword',
  'passwordConfirmation',
  'otp',
  'otpCode',
  'code',
  'codeHash',
  'code_hash',
  'token',
  'rawToken',
  'tokenHash',
  'token_hash',
  'sessionToken',
]);

function redact(value: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[redacted]' : v;
  }
  return out;
}

export interface RecordAuditLogInput {
  actorEmployeeId: string | null;
  actorType: ActorType;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorEmployeeId: input.actorEmployeeId,
        actorType: input.actorType,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: redact(input.before) as never,
        after: redact(input.after) as never,
        ipAddress: input.ipAddress,
      },
    });
  }

  async list(params: { limit: number; cursor?: string }) {
    const items = await this.prisma.auditLog.findMany({
      take: params.limit,
      ...(params.cursor ? { skip: 1, cursor: { id: params.cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }
}
