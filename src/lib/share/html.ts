export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Section = {
  title: string;
  items: Array<{ heading: string; lines: string[] }>;
};

export function renderShareHtml(input: {
  memberName: string;
  createdAt: string;
  expiresAt: string;
  versionLabels: string[];
  sections: Section[];
}) {
  const sections = input.sections
    .filter((section) => section.items.length)
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2>${section.items.map((item) => `<article><h3>${escapeHtml(item.heading)}</h3>${item.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</article>`).join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>キャリア目標共有</title></head><body><header><h1>キャリア目標共有</h1><p>対象: ${escapeHtml(input.memberName)}</p><p>作成日時: ${escapeHtml(input.createdAt)}</p><p>共有期限: ${escapeHtml(input.expiresAt)}</p><p>対象version: ${escapeHtml(input.versionLabels.join(", "))}</p><p>このURLを受け取った本人向けの資料です。第三者へ転送しないでください。</p></header>${sections}<footer><p>この資料は共有時点の不変スナップショットです。閲覧だけでは本人確認済みになりません。</p><p><a href="?download=1" download="career-share.html">HTMLをダウンロード</a></p><p>印刷にはブラウザの印刷機能を使用してください。</p></footer></body></html>`;
}

export const publicShareCsp =
  "default-src 'none'; style-src 'none'; img-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
