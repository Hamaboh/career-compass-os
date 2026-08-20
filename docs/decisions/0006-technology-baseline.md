# ADR-0006: Technology Baseline

- Status: Accepted
- Decision: Node.js 24 LTS、npm workspaces、Next.js 16、React 19、Tailwind CSS 4、NestJS 11、PostgreSQL 18、Prisma 7 GA、Redis 8をPhase 0のmajor baselineとする。
- Reason: 実装開始時の選定揺れをなくし、LTS/GAの互換系列へ固定する。
- Alternatives: 実装時点の任意最新版、RC/beta、複数package manager、microservice構成は採用しない。
- Consequences: Phase 0でcompatibleな最新security patchへ固定し、lockfileとcontainer image version/digestをcommitする。major変更はADRと影響確認が必要。
- Security: EOL、既知脆弱性を持つpatch、floating image tagを禁止し、CIでdependency/container scanを行う。
- Migration: 新規実装のため既存application migrationはない。
- Test: clean install、format、lint、typecheck、unit、build、health、empty DB migration、secret scan。
