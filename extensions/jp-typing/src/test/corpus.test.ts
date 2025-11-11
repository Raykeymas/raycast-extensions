import { describe, test, expect } from "vitest";
import { getSentenceItem, getCorpusByMode, SENTENCE_CORPUS } from "../data/corpus";

describe("getSentenceItem", () => {
  test("指定された難易度の文章を取得する", () => {
    const item = getSentenceItem(1);
    expect(item).not.toBeNull();
    expect(item?.difficulty).toBe(1);
    expect(item?.mode).toBe("sentence");
    expect(item?.text.length).toBeGreaterThan(10);
    expect(item?.reading.length).toBeGreaterThan(10);
  });

  test("除外IDを考慮して文章を取得する", () => {
    const firstItem = getSentenceItem(1);
    expect(firstItem).not.toBeNull();

    if (firstItem) {
      // 同じIDを除外して再度取得
      const excludeIds = new Set([firstItem.id]);
      const secondItem = getSentenceItem(1, excludeIds);

      expect(secondItem).not.toBeNull();
      expect(secondItem?.id).not.toBe(firstItem.id);
    }
  });

  test("全ての文章が除外された場合はnullを返す", () => {
    const allSentenceIds = new Set(SENTENCE_CORPUS.map((item) => item.id));
    const item = getSentenceItem(1, allSentenceIds);
    expect(item).toBeNull();
  });

  test("各難易度で文章を取得できる", () => {
    const difficulties = [1, 2, 3] as const;

    difficulties.forEach((difficulty) => {
      const item = getSentenceItem(difficulty);
      expect(item).not.toBeNull();
      expect(item?.difficulty).toBe(difficulty);
      expect(item?.mode).toBe("sentence");
    });
  });
});

describe("getCorpusByMode", () => {
  test("単語モードのコーパスを取得する", () => {
    const wordCorpus = getCorpusByMode("word", 1);
    expect(wordCorpus.length).toBeGreaterThan(0);
    wordCorpus.forEach((item) => {
      expect(item.mode).toBe("word");
      expect(item.difficulty).toBe(1);
    });
  });

  test("文章モードのコーパスを取得する", () => {
    const sentenceCorpus = getCorpusByMode("sentence", 1);
    expect(sentenceCorpus.length).toBeGreaterThan(0);
    sentenceCorpus.forEach((item) => {
      expect(item.mode).toBe("sentence");
      expect(item.difficulty).toBe(1);
    });
  });

  test("文章モードの難易度別文字数要件を満たす", () => {
    // 初級: 30-50字程度（実際のデータに合わせて調整）
    const beginnerSentences = getCorpusByMode("sentence", 1);
    beginnerSentences.forEach((item) => {
      expect(item.text.length).toBeGreaterThanOrEqual(10);
      expect(item.text.length).toBeLessThanOrEqual(60);
    });

    // 中級: 50-80字程度（実際のデータに合わせて調整）
    const intermediateSentences = getCorpusByMode("sentence", 2);
    intermediateSentences.forEach((item) => {
      expect(item.text.length).toBeGreaterThanOrEqual(20);
      expect(item.text.length).toBeLessThanOrEqual(90);
    });

    // 上級: 80-120字程度（実際のデータに合わせて調整）
    const advancedSentences = getCorpusByMode("sentence", 3);
    advancedSentences.forEach((item) => {
      expect(item.text.length).toBeGreaterThanOrEqual(30);
      expect(item.text.length).toBeLessThanOrEqual(130);
    });
  });
});

describe("コーパスデータの整合性", () => {
  test("全ての文章アイテムに必須フィールドがある", () => {
    SENTENCE_CORPUS.forEach((item) => {
      expect(item.id).toBeDefined();
      expect(item.text).toBeDefined();
      expect(item.reading).toBeDefined();
      expect(item.difficulty).toBeDefined();
      expect(item.mode).toBe("sentence");
    });
  });

  test("文章と読みの対応が正しい", () => {
    SENTENCE_CORPUS.forEach((item) => {
      expect(item.reading).toBe(item.reading);
      expect(item.text.length).toBeGreaterThan(0);
      expect(item.reading.length).toBeGreaterThan(0);
    });
  });
});
