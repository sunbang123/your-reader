import assert from "node:assert/strict";
import test from "node:test";
import { runPipeline } from "./pipeline";

test("분석, 코멘트, 펜팔 응답을 순서대로 조합한다", async () => {
  const replies = [
    JSON.stringify({ summary: "조용한 긴장이 느껴져요.", dominantEmotion: "긴장", scores: { 안도: 0.2, 그리움: 0.3, 긴장: 0.9, 기쁨: 0.1 }, evidence: { 긴장: "결과를 기다림" }, highlightedSentence: "결과를 기다리는 밤이 길었다." }),
    JSON.stringify({ comment: "기다리는 밤이 길었다는 문장이 오래 남아요.", language: "ko" }),
    JSON.stringify({ translationEn: "The night felt long as I waited for the result.", commentEn: "That long night stayed with me." }),
  ];
  const calls: string[] = [];
  const result = await runPipeline({ entryId: "entry", title: "밤", body: "결과를 기다리는 밤이 길었다.", personaId: "listener" }, async (messages) => {
    calls.push(messages[0].content);
    return replies.shift() ?? "";
  }, "test-model");

  assert.equal(calls.length, 3);
  assert.equal(result.dominantEmotion, "긴장");
  assert.equal(result.translationEn, "The night felt long as I waited for the result.");
});
