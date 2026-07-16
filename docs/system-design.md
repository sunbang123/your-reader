# Your Reader — Planning & System Design

## 1. Product flow

1. **Persona selection** — 사용자는 현재 필요한 읽기 방식과 말투를 고른다.
2. **Immersive editor** — 넓은 종이형 편집기에서 글을 쓰고 빗소리 등 백색소음을 켠다.
3. **Reading result** — 감정 점수와 근거 요약, 선택한 페르소나의 답장을 확인한다.
4. **Library** — 글, 감정 변화, 함께한 페르소나를 다시 살펴본다.

분석 결과는 진단이나 평가가 아니라 글에서 감지된 정서적 단서로 표현한다. 낮은 점수도 부정적으로 낙인찍지 않으며, 위기 표현이 감지되면 생성형 답장보다 안전 안내를 우선한다.

## 2. Application architecture

- **UI:** Next.js App Router + TypeScript
- **Auth/DB:** Supabase Auth + PostgreSQL
- **AI orchestration:** Next.js Route Handler 또는 Supabase Edge Function
- **Analysis:** 감정 분류 모델의 원시 결과를 0–1 값으로 정규화
- **Generation:** 원문, 감정 요약, 페르소나 가이드라인을 조합해 구조화된 답장 생성
- **Optional translation:** 외국인 펜팔 페르소나에서만 번역 결과 저장

AI 처리 상태는 `draft → queued → analyzing → completed | failed`로 관리한다. 원문 저장과 AI 작업을 분리해 모델 장애가 글 유실로 이어지지 않게 한다.

## 3. Data model

| Table | Responsibility | Important relationships |
| --- | --- | --- |
| `profiles` | 표시 이름과 사용자 설정 | `auth.users`와 1:1 |
| `personas` | 말투, 경계, 프롬프트 버전 | 여러 글과 코멘트에서 참조 |
| `entries` | 제목, 본문, 상태, 작성 시점 | 사용자와 페르소나에 속함 |
| `emotion_analyses` | 모델·버전·요약·정서 점수 | 글과 1:1 |
| `emotion_scores` | 감정별 정규화 점수와 근거 | 분석과 N:1 |
| `generated_comments` | 페르소나 답장·번역·생성 정보 | 글과 N:1 |
| `sound_preferences` | 백색소음 종류와 음량 | 사용자와 1:1 |

## 4. Security and privacy

- 모든 사용자 콘텐츠 테이블에 RLS를 적용하고 `auth.uid()`로 소유권을 확인한다.
- 페르소나는 공개 읽기만 허용하며 작성·수정은 서버 역할로 제한한다.
- AI 공급자에게 보내는 데이터는 최소화하고 로그에 원문을 남기지 않는다.
- 사용자는 글과 파생 분석·코멘트를 함께 삭제할 수 있어야 한다.
- 감정 점수는 의료 정보나 진단 결과로 표시하지 않는다.

## 5. API contracts

- `POST /api/entries` — 초안을 저장하고 entry id 반환
- `PATCH /api/entries/:id` — 제목·본문·선택 페르소나 수정
- `POST /api/entries/:id/analyze` — 분석 작업 시작, idempotency key 사용
- `GET /api/entries/:id/result` — 분석과 최신 코멘트 반환
- `GET /api/library?cursor=` — 사용자의 글을 cursor pagination으로 조회

## 6. MVP acceptance criteria

- 네 화면이 모바일과 데스크톱에서 동작한다.
- 새 글은 AI 호출 전에 영구 저장된다.
- 분석 실패 후 원문을 유지한 채 재시도할 수 있다.
- 다른 사용자의 글·분석·답장을 읽거나 수정할 수 없다.
- 페르소나 프롬프트 버전을 결과와 함께 추적할 수 있다.
