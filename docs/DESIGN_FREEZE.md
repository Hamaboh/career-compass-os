# 設計凍結（Design Freeze）

**このリポジトリは、以下のPhase 1〜4ドキュメントを正式な実装仕様として扱う。**
実装中にこのファイルを読む者（人間・AIエージェントを問わず）は、下記ルールに従うこと。

## 正式仕様（正）

| Phase | 内容 | リンク |
|---|---|---|
| Phase 1 | プロダクト定義（コンセプト・ペルソナ・ユースケース） | https://claude.ai/code/artifact/115f9888-cfe3-4991-bd65-420274f672e1 |
| Phase 2 | AIロジック仕様（自己分析・Why・SMART・AI境界） | https://claude.ai/code/artifact/bc9c7f1f-6ea8-400a-9973-b0d28f0aa861 |
| Phase 3 | 技術設計（DB ER・RBAC・認証・API・AIアーキテクチャ・セキュリティ） | https://claude.ai/code/artifact/876a77fb-c736-4061-9b4e-041e50e4dc30 |
| Phase 4 | UI/UX設計・開発計画・最終レビュー（設計凍結版） | https://claude.ai/code/artifact/9b4ad754-50b3-4b37-8346-9d86e41a6396 |

Phase 4冒頭に記載の通り、23章の最終レビューで洗い出したMVPブロッカーは全てPhase 4本文へ反映済みであり、Phase 2・Phase 3への変更は発生していない。

## 実装ルール

1. **実装上必要な軽微な変更は許可する。** ただし変更した場合は、コミットメッセージまたはPRに変更理由を明示する。
2. **DB/API/権限モデルに影響する変更は勝手に実施しない。** Phase3で確定した62テーブルのER設計・RBAC権限フラグ（7章）・APIリソース構造（13章）を変更する必要が生じた場合は、実装を止めて先に報告する。
3. **要件と実装が矛盾する場合は実装前に報告する。** 「仕様通りに作ると動かない」「仕様に漏れがある」等に気づいた時点で、黙って解釈で埋めずに報告する。
4. **既存設計との整合性を最優先する。** 新しいライブラリ・パターンを導入したくなった場合も、まず既存の技術スタック（下記）で要件を満たせないか検討する。
5. **AIによる自動判断と人間による確定判断を混同しない。** 実装するすべての機能で、「AIが提案する」操作と「人間が確定する」操作をコード上も明確に分離する（Phase2 FOUNDATION §絶対原則、Phase3 14章のDB権限分離が技術的な強制手段）。

## 確定済み技術スタック（Phase3 2章）

- バックエンド: NestJS（Node.js 22 LTS, TypeScript）
- フロントエンド: Next.js 15（App Router）+ React 19 + TypeScript + Tailwind CSS
- DB: PostgreSQL 16（自己ホスト、Prisma ORM）
- キャッシュ/セッション/キュー: Redis 7 + BullMQ
- オブジェクトストレージ: MinIO（自己ホスト）
- リバースプロキシ/TLS: Caddy
- デプロイ: Docker Compose、単一マシン、1〜10人規模、インフラ費用0円
- AI: Anthropic Claude API（AI Orchestration Service経由のみ、直接呼び出し禁止）

## 開発順序（Phase4 18章 + Step -1）

1. Step -1: リポジトリ初期化・ディレクトリ構成・Docker Compose雛形・環境変数テンプレート・Lint規約（**このコミットの内容**）
2. Step 0: 認証基盤（AUTH-01/02/03/04）
3. Step 1: 最小目標CRUD（AI対話なし）
4. Step 2: SMARTチェック
5. Step 3: 目標作成ウィザードのAI対話化
6. Step 4: 進捗・振り返り・通知
7. Step 5: UL機能（RLS動作確認込み）
8. Step 6: 1on1機能（UL-10 本番中/事後まとめタブ統合版）
9. Step 7: Admin基盤
10. Step 8: 制度接続・KPI管理
11. Step 9: 監査ログ・AI設定
12. Step 10: 横断仕上げ（エラーUX/Empty State全画面適用）

各Stepの開始前に、Phase 4 21章のDefinition of Doneに照らして前Stepが完了しているかを確認する。
