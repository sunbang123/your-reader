import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmotionResults, parseModelJson, resolveHighlight } from "./parse";

test("코드 펜스 안의 JSON을 읽는다", () => {
  assert.deepEqual(parseModelJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```"), { ok: true });
});

test("JSON 뒤에 설명이나 다른 JSON이 붙어도 첫 번째 객체만 읽는다", () => {
  const response = '{"comment":"첫 번째 응답","language":"ko"}\n추가 설명\n{"comment":"두 번째 응답"}';
  assert.deepEqual(parseModelJson<{ comment: string; language: string }>(response), {
    comment: "첫 번째 응답",
    language: "ko",
  });
});

test("문자열 안의 중괄호와 이스케이프를 JSON 경계로 오해하지 않는다", () => {
  const response = '결과: {"comment":"그는 \\"괜찮아 {정말}\\"라고 말했다.","language":"ko"} 끝';
  assert.deepEqual(parseModelJson<{ comment: string; language: string }>(response), {
    comment: '그는 "괜찮아 {정말}"라고 말했다.',
    language: "ko",
  });
});

test("유효한 JSON이 없으면 명확한 오류를 반환한다", () => {
  assert.throws(() => parseModelJson("JSON이 없는 응답"), /유효한 JSON/);
});

test("감정 점수를 0과 1 사이로 보정한다", () => {
  const result = normalizeEmotionResults({ 안도: 1.4, 긴장: -1, 기쁨: "0.45" });
  assert.deepEqual(result.map(({ score }) => score), [1, 0, 0, 0.45]);
});

test("모델 문장이 원문과 다르면 원문의 문장을 대신 고른다", () => {
  const body = "짧은 문장. 이 문장이 조금 더 오래 마음에 남았다.";
  assert.equal(resolveHighlight(body, "바뀐 문장"), "이 문장이 조금 더 오래 마음에 남았다.");
});
