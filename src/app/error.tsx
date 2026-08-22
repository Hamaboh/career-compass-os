"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <h1>処理を完了できませんでした</h1>
      <p>時間をおいて再度お試しください。</p>
      <button onClick={reset}>再試行</button>
    </main>
  );
}
