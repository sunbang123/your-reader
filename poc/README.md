# AI 모델 npm 프로토타입

`npm run poc`은 mock이 아니라 실제 Hugging Face ONNX 모델 3개를 순차 실행한다.

1. 다국어 zero-shot 모델로 한국어 감정을 분석한다.
2. 문장별 감정 강도와 글 전체 핵심 감정의 일치도로 하이라이트를 고른다.
3. EXAONE으로 선택한 페르소나의 공감 답글을 생성한다.
4. NLLB로 원본 한국어 에세이를 영어로 번역한다.
5. 단계별 지연시간과 페르소나 규칙 위반을 JSON/Markdown 보고서로 저장한다.

## 실행

```powershell
npm install
npm run poc
```

페르소나나 샘플 하나만 지정할 수 있다.

```powershell
npm run poc -- --persona penpal
npm run poc -- --sample joy_and_gratitude
```

지원 페르소나는 `listener`, `penpal`, `librarian`이다. 모델은 최초 실행 때 `.cache/transformers`에 다운로드되고 이후 재사용된다. 다운로드 중에는 10% 단위 진행률이 표시된다.

결과 파일:

- `poc/results/prototype-report.json`: 전체 원시 결과
- `poc/results/prototype-report.md`: 사람이 읽기 쉬운 요약

## 검증

```powershell
npm run poc:test
npm run build
```

단위 테스트의 키워드 분석기는 하이라이트 수식만 빠르게 검증하는 테스트 대역이다. 제품 프로토타입 실행 경로인 `npm run poc`에서는 사용하지 않는다.

## 현재 모델

- 감정: `Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`
- 생성: `onnx-community/EXAONE-3.5-2.4B-Instruct`
- 번역: `Xenova/nllb-200-distilled-600M`

이 조합은 기술 검증용이다. 실제 감정 모델의 품질과 NLLB 번역 품질이 통과 기준에 미달한 상태이므로 프로덕션 모델로 확정하지 않는다.
