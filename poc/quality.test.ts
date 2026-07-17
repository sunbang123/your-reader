import assert from "node:assert/strict";
import test from "node:test";
import { findPersonaViolations } from "./quality";

test("직접 및 간접 행동 권유를 탐지한다", () => {
  assert.deepEqual(findPersonaViolations("용기를 내어 다시 시작할 수 있기를 바랍니다."), ["행동 권유 또는 해결책 제시"]);
  assert.deepEqual(findPersonaViolations("가족에게 이야기를 나누어 보는 것도 좋을 것 같습니다."), ["간접적인 행동 제안"]);
});

test("판단 없는 감정 반영은 위반으로 보지 않는다", () => {
  assert.deepEqual(findPersonaViolations("버스에서 눈물이 났다는 문장이 오래 남습니다."), []);
});
