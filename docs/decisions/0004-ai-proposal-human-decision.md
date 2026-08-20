# ADR-0004: AI Proposal and Human Decision Separation

- Status: Accepted
- Decision: AI outputをproposalとして保存し、人間decision endpointを経て正式domain dataへ反映する。
- Reason: 本人の納得感、説明責任、AI誤推測訂正、監査を担保する。
- Consequences: provenance、proposal state、decision history、UIの視覚分離が必須。
