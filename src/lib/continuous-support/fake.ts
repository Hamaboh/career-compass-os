export type SupportProposal = {
  type: "NEXT_CHALLENGE" | "NEXT_ACTION" | "GOAL_CHANGE";
  content: string;
  rationale: string;
};

/**
 * I5 deliberately has no external AI connection. These stable proposals make
 * the human/AI boundary and complete manual flow testable until I6/POC-01.
 */
export function deterministicSupportProposals(): SupportProposal[] {
  return [
    {
      type: "NEXT_CHALLENGE",
      content: "本人が望む方向と、現在使える余力を一緒に確認する",
      rationale:
        "次の課題は不足の断定ではなく、本人の希望と余力から選ぶための候補です。",
    },
    {
      type: "NEXT_ACTION",
      content: "本人が小さく試せる行動を一つ選び、証拠と確認日を決める",
      rationale:
        "実行可能性を本人と確認するための候補であり、自動割当ではありません。",
    },
    {
      type: "GOAL_CHANGE",
      content: "現行目標の継続、修正、保留、変更しない選択肢を比較する",
      rationale:
        "目標変更は候補提示に留め、新版作成と本人再確認を別操作にします。",
    },
  ];
}
