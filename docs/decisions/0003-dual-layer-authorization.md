# ADR-0003: API Policy and PostgreSQL RLS

- Status: Accepted
- Decision: API Guard/Policyを主認可、PostgreSQL RLSを個人・Unit dataの第二防御とする。
- Reason: Frontend制御や単一防御の欠陥から機微情報を保護する。
- Consequences: transaction-local actor context、non-bypass DB role、cross-unit integration testが必要。
