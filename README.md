# 羅針盤キャリアOS

SES企業向け、AI支援によるキャリア形成・目標管理・1on1支援アプリ。

設計仕様（正式版・変更ルール）は [`docs/DESIGN_FREEZE.md`](docs/DESIGN_FREEZE.md) を参照。実装に着手する前に必ず目を通すこと。

## 現在の状態

Phase 1〜4設計に基づくMVP実装がひととおり完了。バックエンド（NestJS）は認証・RBAC・自己理解/目標階層/1on1/通知/制度マスタ等の主要モジュールを実装済み、フロントエンド（Next.js）は42画面すべてを実装済み。詳細な実装状況・残課題は完了報告およびDESIGN_FREEZE.mdを参照。

## ディレクトリ構成

```
.
├── apps/
│   ├── api/    NestJSバックエンド（auth/employees/units/goals/goal-continuity/
│   │            self-understanding/one-on-one/notifications/institutional/
│   │            app-settings/invitations/reminders/ai-orchestration/audit/mail）
│   └── web/     Next.js フロントエンド（App Router, 42画面：login/goals/checkpoints/
│                reflections/one-on-ones/self-analysis/dreams/why/notifications/
│                profile/ul/admin/invitations/password-reset 等）
├── packages/
│   └── shared/  フロント/バック共通の型・定数（ステータス語彙・RBAC権限フラグ名など）
├── infra/
│   └── caddy/    リバースプロキシ設定
├── docs/
│   └── DESIGN_FREEZE.md 正式仕様への参照と実装ルール
├── .devcontainer/ GitHub Codespaces / VS Code Dev Containers設定
├── docker-compose.yml
└── .env.example
```

## セットアップ

### オプションA: GitHub Codespaces（推奨・最速）

このリポジトリを開いて「Code」→「Codespaces」→「Create codespace on main」を選ぶだけで、Node 22 + Docker Composeスタック（Postgres/Redis/MinIO/Caddy/API/Web/Worker）が自動的に立ち上がる（`.devcontainer/`参照）。ローカルマシンのディスク容量やDocker Desktopの状態に左右されないため、ローカル環境が逼迫している場合はこちらを優先する。

### オプションB: ローカル環境

前提:

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
