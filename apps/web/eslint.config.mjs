import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts はNext.jsが自動再生成する型参照ファイルでgit管理対象外(.gitignore参照)。
    // CIではチェックアウトされないため気づかなかったが、ローカルではファイルが残り続け
    // triple-slash-reference規則に引っかかる(2026-08-16、npm run lintのローカル実行で発覚)。
    ignores: ['.next/', 'node_modules/', 'next-env.d.ts'],
  },
];

export default eslintConfig;
