import { SetMetadata } from '@nestjs/common';

/**
 * Phase3 16.10節: 認可チェックから除外するルートは明示的な@Public()デコレータを必須とする。
 * 除外対象は最小セット（ログイン・招待関連トークンフロー・ヘルスチェック）に限定する。
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
