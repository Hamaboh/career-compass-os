import type { Config } from 'tailwindcss';

// Phase4 5章の画面アーキタイプ・6.2節のAI提案共通カード型などをここでデザイントークン化していく
// （色文法: ✨AI提案=中立色、✅/⚠️/➖=判定結果、矢印=傾向。23.5 U1の指摘を反映）。
// Step -1では既定のTailwind設定のみ。トークン設計はStep 1（最小目標CRUD）着手時に着手する。
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
