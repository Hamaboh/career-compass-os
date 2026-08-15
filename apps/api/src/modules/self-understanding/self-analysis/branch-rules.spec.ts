import { decideBranch } from './branch-rules';

describe('decideBranch', () => {
  it('isSkip=trueなら常にdefer_categoryを返す（他の条件より優先）', () => {
    const result = decideBranch({
      isSkip: true,
      rawText: null,
      dictionaryEmotionIntensity: 90,
      depthLevel: 0,
      answersInCategoryCount: 5,
    });
    expect(result.type).toBe('defer_category');
  });

  it('感情強度が閾値以上かつ深掘り上限未満ならdeep_diveを返す', () => {
    const result = decideBranch({
      isSkip: false,
      rawText: 'とても悔しい経験でした。もう二度と繰り返したくありません。',
      dictionaryEmotionIntensity: 40,
      depthLevel: 0,
      answersInCategoryCount: 1,
    });
    expect(result.type).toBe('deep_dive');
  });

  it('感情強度が高くても深掘り上限に達していればdeep_diveにならない', () => {
    const result = decideBranch({
      isSkip: false,
      rawText: '十分に長い回答文です。'.repeat(3),
      dictionaryEmotionIntensity: 40,
      depthLevel: 2,
      answersInCategoryCount: 1,
    });
    expect(result.type).not.toBe('deep_dive');
  });

  it('同カテゴリの回答数が閾値以上ならsynthesize_insight_earlyを返す', () => {
    const result = decideBranch({
      isSkip: false,
      rawText: '十分に長い回答文です。'.repeat(3),
      dictionaryEmotionIntensity: 0,
      depthLevel: 0,
      answersInCategoryCount: 3,
    });
    expect(result.type).toBe('synthesize_insight_early');
  });

  it('回答が極端に短い場合はreframeを返す', () => {
    const result = decideBranch({
      isSkip: false,
      rawText: 'はい',
      dictionaryEmotionIntensity: 0,
      depthLevel: 0,
      answersInCategoryCount: 1,
    });
    expect(result.type).toBe('reframe');
  });

  it('特にトリガーがなければadvanceを返す', () => {
    const result = decideBranch({
      isSkip: false,
      rawText: '十分に長さのある、普通の回答です。特に強い感情表現はありません。',
      dictionaryEmotionIntensity: 0,
      depthLevel: 0,
      answersInCategoryCount: 1,
    });
    expect(result.type).toBe('advance');
  });
});
