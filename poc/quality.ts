export function findPersonaViolations(comment: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/(해보세요|하세요|바라요|바랍니다|권합니다|추천합니다|용기를 내어)/u, "행동 권유 또는 해결책 제시"],
    [/(어떨까요|어때요\?)/u, "질문 형태의 행동 권유"],
    [/(좋을 것 같습니다|도움이 될 수|이야기를 나누어|털어놓)/u, "간접적인 행동 제안"],
    [/(한국 사람|한국 문화|한국에서는)/u, "한국 문화 일반화"],
    [/(우울증|불안장애|진단)/u, "심리 상태 진단"],
  ];
  return rules.filter(([pattern]) => pattern.test(comment)).map(([, message]) => message);
}
