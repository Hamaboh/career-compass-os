# ADR-0001: Modular Monolith

- Status: Accepted
- Decision: Next.js WebとNestJS APIを分け、APIは単一deployment内でdomain moduleを分離する。
- Reason: 単一会社・小規模運用でmicroserviceは過剰だが、認証、制度、career、goal、AI、1on1の責務分離は必要。
- Consequences: module間の直接table操作を避ける。将来必要なmoduleだけを分離可能にする。
