# Phase 0: 旧設計の失効範囲と再設計ガード

## 1. 状態

リポジトリに存在する旧Phase 1〜4、旧Design Freeze、補助仕様、旧ADRは、旧要件を保存する履歴資料である。新しいPhase 1〜5とDesign Freezeが完成するまで、実装仕様として使用してはならない。

旧文書は現時点で削除しない。Phase 1以降の再設計で置換・再編する。

## 2. 旧前提から変更された主要事項

| 領域 | 旧前提 | 新しい基準 |
|---|---|---|
| 利用者 | ADMIN、UL、MEMBER、EXCLUDEDを含む社員向け | ログインは約7 UL + 約5上位役職者。MemberはMVPでログインしない |
| 認証 | 招待、OTP、アプリパスワード、セッション | Google Workspace + Cloudflare Accessを基本案とする |
| 目的 | 社員本人による自己分析・継続利用を含む | ULの目標形成品質と事務工数削減を中心とし、本人はHTML・1on1で確認 |
| 人事制度 | 会社KPIとの接続を広く扱う | 本人の幸福・ライフ・キャリアを優先し、必要な場合のみ制度参照 |
| 人事評価 | 評価情報の管理を広く設計 | 正式評価・給与決定ツールにしない |
| AI | 幅広い本人向けAI | UL向け目標形成、Why、SMART、1on1支援をMVP必須とする |
| AIデータ | Context境界中心 | 外部送信前の強制匿名化とULプレビューを必須とする |
| 技術 | Next.js + NestJS + PostgreSQL + Redis + BullMQ + S3互換 | Cloudflare Workers + D1 + R2 + Access + AI Gatewayを基本案として再評価 |
| 認可 | PostgreSQL RLSを含む多層認可 | APIのロール・Unit scopeを必須とし、D1前提の強制方法をPhase 3で確定 |
| インフラ | 複数常駐サービス | 最小コストのCloudflare中心構成 |

## 3. 現時点で実装してはならないもの

- アプリケーションソースコード
- framework初期化
- package追加
- DB schema・migration
- Cloudflare resource作成
- Vercel deployment
- Google Workspace・Cloudflare Access本番設定
- AI providerの本番接続
- 旧データモデル、API、RBAC、認証の流用

## 4. 旧ADRの扱い

旧ADRはすべて履歴参照とする。特に次は新Phase 3で再評価が必要である。

- modular monolith
- server-side session
- PostgreSQL RLSを前提とするdual-layer authorization
- technology baseline
- external service adapters

「AIは提案し人間が決定する」「制度版を固定する」という原則は新方針とも整合するが、新Design Freezeへ改めて取り込まれるまでは旧ADR自体を実装根拠にしない。

## 5. 実装開始ゲート

次をすべて満たすまで実装を開始しない。

1. 新Phase 1〜4が完成している。
2. Phase 5の最終レビューが完了している。
3. 新しいDesign Freezeが完成している。
4. 要件、AI、データ、API、権限、画面、テストのトレーサビリティがある。
5. AIモデルPoCの計画と受入基準が確定している。
6. 旧仕様との矛盾が解消または明示されている。
7. 実装開始可否が新Design Freezeで`READY`になっている。

## 6. Phase 0後の正式な読順

新Design Freeze完成までは次を読む。

1. `docs/phase-0/00-source-baseline.md`
2. `docs/phase-0/01-decisions.md`
3. `docs/phase-0/02-glossary.md`
4. `docs/phase-0/03-policy-rules.md`
5. `docs/phase-0/04-supersession.md`
6. 新Phase文書（完成したものから。ただしDesign Freezeまでは実装不可）

