# ADR-0008: Implementation 0 runtime and OpenNext versions

- Status: `ACCEPTED` (2026-08-20)
- Scope: POC-02 / Implementation 0 only

## Decision

Pin Node.js `22.22.0` LTS, pnpm `10.28.1`, Next.js `15.5.23`, React `19.2.4`, `@opennextjs/cloudflare` `1.20.2`, and Wrangler `4.125.0`. All are stable exact releases. OpenNext accepts Next.js `>=15.5.21 <16` and Wrangler `^4.86.0`; these pins satisfy that contract. Node 22 satisfies current Wrangler's Node 22 minimum.

Keep one App Router full-stack deployment. POC-02 covers an App Router page, Route Handler, side-effect-free Server Action, Workers build/local preview, D1/R2 declarations, security headers, and health request. No production resource or connection is created.

## Dependency, license, environment, and secrets review

Runtime packages are limited to Next.js/React and Zod. Tooling is TypeScript, ESLint/Prettier, Vitest, Workers types, Wrangler, and OpenNext. Registry metadata reports MIT for Next.js, pnpm, and OpenNext; Wrangler is MIT or Apache-2.0. The lockfile, high-severity audit CI gate, secret scan, and Dependabot protect the supply chain.

`local/CI`, `preview`, and `production` have separate declarations and must never share data. Checked-in IDs are synthetic placeholders. Real IDs, Access/AI configuration, and credentials are platform-managed and never placed in variables, fixtures, logs, errors, screenshots, or pull requests. Access and AI are disabled fakes in local/CI.

## Alternatives, results, rollback, and risks

Next.js 16 was deferred to reduce the initial compatibility surface while using the newest OpenNext-supported 15.5 security patch. Node 20 is incompatible with current Wrangler. Separate APIs, containers, PostgreSQL, Redis, Prisma, and BullMQ contradict the Design Freeze.

Acceptance requires `next build`, `opennextjs-cloudflare build`, local Wrangler preview, binding tests, and header/health smoke checks. Roll back through an immutable Workers version (`wrangler rollback`) or the preceding reviewed commit; I0 has no database migration. Production deployment is excluded.

Residual risks are platform/adapter changes and untested production bindings. Exact pins, lockfile, CI, and fresh preview checks mitigate them. Real Access, D1/R2 operations, AI, and production rollout remain later gated work.
