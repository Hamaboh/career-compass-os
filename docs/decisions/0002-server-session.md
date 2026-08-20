# ADR-0002: Server-side Opaque Session

- Status: Accepted
- Decision: Browser認証はHttpOnly Cookieのopaque session IDとRedis session storeを使用する。
- Reason: tokenをbrowser JavaScriptから隔離し、失効、EXCLUDED、password変更、role変更を即時反映する。
- Consequences: CSRF対策、Redis可用性、session rotation、fail-closedが必要。
