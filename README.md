# 羅針盤キャリアOS

SES企業向け、AI支援によるキャリア形成・目標管理・1on1支援アプリ。

設計仕様（正式版・変更ルール）は [`docs/DESIGN_FREEZE.md`](docs/DESIGN_FREEZE.md) を参照。実装に着手する前に必ず目を通すこと。

## 現在の状態

このリポジトリは **Step -1（土台整備）** の段階。ディレクトリ構成・Docker Compose・環境変数テンプレート・Lint規約のみが揃っており、業務ロジック（DBスキーマ・認証・画面等）はまだ実装されていない。次はStep 0（認証基盤）に進む。

## ディレクトリ構成

```
.
├── apps/
│   ├── api/          NestJSバックエンド（Auth/RBAC Guard/Domain API/AI Orchestration Service）
│   └── web/           Next.js フロントエンド（App Router）
├── packages/
│   └── shared/         フロント/バック共通の型・定数（ステータス語彙・RBAC権限フラグ名など）
├── infra/
│   └── caddy/           リバースプロキシ設定
├── docs/
│   └── DESIGN_FREEZE.md 正式仕様への参照と実装ルール
├── docker-compose.yml
└── .env.example
```

## セットアップ（初回）

前提: このマシンにはまだ **Node.js と Docker がインストールされていません**（調査済み）。まず以下を用意する。

1. Node.js 22 LTS（`.nvmrc`参照。nvm等でのインストールを推奨）
2. Docker Desktop（または互換のDocker/Compose環境）

用意ができたら:

```bash
# 1. 環境変数ファイルを作成（値はダミーのまま開発には使えるが、本番相当では必ず変更する）
cp .env.example .env

# 2. 依存関係のインストール（ワークスペース一括）
npm install

# 3. Docker Composeスタックを起動（Postgres/Redis/MinIO/Caddy/API/Web/Worker）
docker compose up -d

# 4. 動作確認
curl -k https://localhost/api/healthz      # NestJS ヘルスチェック（healthzはAPIバージョニング対象外、v1配下ではない）
open https://localhost                      # Next.js トップページ
```

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev:api` | NestJSをホットリロード付きで単体起動（Docker外） |
| `npm run dev:web` | Next.jsをホットリロード付きで単体起動（Docker外） |
| `npm run lint` | 全ワークスペースのLint |
| `npm run typecheck` | 全ワークスペースの型チェック |
| `npm run build` | 全ワークスペースのビルド |

## 設計ドキュメント

- Phase 1: [プロダクト定義](https://claude.ai/code/artifact/115f9888-cfe3-4991-bd65-420274f672e1)
- Phase 2: [AIロジック仕様](https://claude.ai/code/artifact/bc9c7f1f-6ea8-400a-9973-b0d28f0aa861)
- Phase 3: [技術設計](https://claude.ai/code/artifact/876a77fb-c736-4061-9b4e-041e50e4dc30)
- Phase 4: [UI/UX設計・開発計画（設計凍結版）](https://claude.ai/code/artifact/9b4ad754-50b3-4b37-8346-9d86e41a6396)
