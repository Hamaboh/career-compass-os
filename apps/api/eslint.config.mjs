// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// 型情報を使う@typescript-eslint推奨ルール(recommendedTypeChecked/projectService)は、
// このサンドボックス実行環境でTSプログラム生成が完了せずハングすることを確認した
// (projectService/project双方で再現、typecheckコマンド(tsc --noEmit単体)は正常終了するため
// TypeScript自体の問題ではなくESLint連携部分に起因すると推測)。型安全性の担保は
// `npm run typecheck`(tsc --noEmit)を正とし、ESLintは型情報を使わない構文ベースの
// ルールセットに留める。この制約が外れた環境ではrecommendedTypeCheckedへ戻すことを推奨する。
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Phase3 16.5節: 生SQL/文字列結合によるSQLクエリ構築を機械的に禁止する足場。
      // Step 0以降、実際のPrismaリポジトリ層実装時にno-restricted-syntax等で具体化する。
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
);
