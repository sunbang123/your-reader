import assert from "node:assert/strict";
import test from "node:test";
import { aggregateForDisplay, MockEmotionAnalyzer, selectHighlight, splitSentences } from "./core";

test("문장을 구분한다", () => {
  assert.deepEqual(splitSentences("첫 문장이다. 두 번째다!"), ["첫 문장이다.", "두 번째다!"]);
});

test("감정이 짙은 문장을 하이라이트한다", async () => {
  const result = await selectHighlight("오늘은 평범했다. 집으로 돌아오는 길에 자꾸 눈물이 났다. 이제 잠을 자야겠다.", new MockEmotionAnalyzer());
  assert.match(result.sentence, /눈물/);
});

test("세부 감정을 화면용 감정 축으로 묶는다", () => {
  const grouped = aggregateForDisplay({ 슬픔: 0.9, 걱정: 0.4, 행복: 0.7 });
  assert.equal(grouped.슬픔, 1);
  assert.ok(grouped.기쁨 > grouped.불안);
});
