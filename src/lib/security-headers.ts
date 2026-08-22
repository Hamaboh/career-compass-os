export function contentSecurityPolicy(nonce: string, production: boolean) {
  const scriptSources = production
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;
  const styleSources = production
    ? `'self' 'nonce-${nonce}'`
    : `'self' 'unsafe-inline'`;

  return [
    "default-src 'self'",
    "img-src 'self' data:",
    `style-src ${styleSources}`,
    `script-src ${scriptSources}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
