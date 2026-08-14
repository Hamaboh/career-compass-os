/**
 * プレースホルダートップページ。Step 0でAUTH-01（ログイン）へのリダイレクト、
 * 認証済みならロール別ダッシュボードへの振り分けに置き換える（Phase4 3.1節 認証フロー）。
 */
export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>羅針盤キャリアOS</h1>
      <p>Step -1（土台整備）完了。次はStep 0（認証基盤）で本実装に着手します。</p>
      <p>
        設計仕様: <code>docs/DESIGN_FREEZE.md</code> 参照。
      </p>
    </main>
  );
}
