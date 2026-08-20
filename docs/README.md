# 設計文書インデックス

## 現在の設計状態

要件変更により、既存のPhase 1〜4、Design Freeze、補助仕様、ADRは履歴資料になりました。現時点では実装根拠として使用できません。

新しい設計はPhase 0から再構築しています。新Phase 1〜5と新Design Freezeが完成するまでコード実装は禁止です。

## 現在の正式な読順

1. [`phase-0/00-source-baseline.md`](phase-0/00-source-baseline.md)
2. [`phase-0/01-decisions.md`](phase-0/01-decisions.md)
3. [`phase-0/02-glossary.md`](phase-0/02-glossary.md)
4. [`phase-0/03-policy-rules.md`](phase-0/03-policy-rules.md)
5. [`phase-0/04-supersession.md`](phase-0/04-supersession.md)
6. 今後作成する新Phase 1〜5
7. 今後作成する新Design Freeze

## Phase 0文書

| 文書 | 目的 |
|---|---|
| [`phase-0/00-source-baseline.md`](phase-0/00-source-baseline.md) | Google Drive一次資料、資料責任境界、原本補正、優先順位 |
| [`phase-0/01-decisions.md`](phase-0/01-decisions.md) | 確定・暫定・PoC待ちの決定台帳 |
| [`phase-0/02-glossary.md`](phase-0/02-glossary.md) | 本人中心、制度、AI、権限、保持の用語定義 |
| [`phase-0/03-policy-rules.md`](phase-0/03-policy-rules.md) | 評価分離、交通費、レスポンス、退職率、共有、保持 |
| [`phase-0/04-supersession.md`](phase-0/04-supersession.md) | 旧仕様の失効範囲、実装禁止、再設計ゲート |

## 旧文書

`00-design-freeze.md`、`01-product-definition.md`〜`15-implementation-readiness.md`、`decisions/`は旧設計の履歴資料です。

- 削除はしない。
- 新設計の根拠として引用しない。
- 新Phaseで採用し直した原則だけを新文書へ移す。
- 新Design Freeze完成後に、履歴ディレクトリへの移動または明確なアーカイブ表示を検討する。

## 重要な変更点

- Member本人ログインからLeader-only MVPへ変更。
- Google Workspace + Cloudflare Accessを認証基本案とする。
- PostgreSQL、Redis、BullMQ、NestJS前提を失効。
- Cloudflare Workers、D1、R2、AI Gateway、Workers AIを基本案として再評価。
- 本人の幸福・ライフ・キャリアを会社制度より上位に置く。
- AIは必須だが、匿名化とUL送信前確認を必須とする。
- 本アプリは正式な人事評価・給与決定ツールにしない。

