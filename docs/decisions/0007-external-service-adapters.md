# ADR-0007: External Service Adapters

- Status: Accepted
- Decision: Mail、LLM、object storage、TLS、backupをadapterとenvironment設定の境界に置く。development/testは外部送信しないmail capture、deterministic fake LLM、local S3-compatible storageを使う。Production未設定時のLLMはfail-closedとし、非AI fallbackを使用する。
- Reason: Vendor契約やcredentialを実装開始条件にせず、privacy、可用性、test再現性を確保する。
- Alternatives: 特定vendor SDKをdomainへ直接組み込むこと、clientからLLMを呼ぶこと、credentialをrepositoryへ保存することは採用しない。
- Consequences: Production providerごとにadapter、contract test、timeout、retry、redaction、healthを実装する。Vendor選定後もdomain/API契約を変更しない。
- Security/Privacy: LLMの保存・training・region・削除・DPAと送信可能data classをproduction前に人間が承認する。Secretはsecret storeから注入する。
- Migration: Provider切替はconfiguration変更を原則とし、保存形式変更がある場合のみ別migrationを作成する。
- Test: Fake adapter、provider contract、timeout、schema failure、redaction、queue retry、fallback、secret非出力を検証する。
