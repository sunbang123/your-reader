export type PersonaId = "listener" | "penpal" | "librarian";

export type Persona = {
  id: PersonaId;
  name: string;
  role: string;
  description: string;
  greeting: string;
  mark: string;
};

export type EmotionScore = {
  label: "안도" | "그리움" | "긴장" | "기쁨";
  score: number;
  color: "sage" | "blue" | "rose" | "amber";
};

export const personas: Persona[] = [
  {
    id: "listener",
    name: "다온",
    role: "차분한 경청자",
    description: "말 사이의 침묵까지 기다리며, 판단 없이 감정의 결을 짚어줘요.",
    greeting: "천천히 이야기해도 괜찮아요. 저는 여기서 끝까지 읽고 있을게요.",
    mark: "다",
  },
  {
    id: "penpal",
    name: "Alex",
    role: "외국인 펜팔",
    description: "한국어로 쓴 마음을 자연스러운 영어 편지와 따뜻한 답장으로 돌려줘요.",
    greeting: "Write as you are. I will meet you gently between the lines.",
    mark: "A",
  },
  {
    id: "librarian",
    name: "해온",
    role: "밤의 사서",
    description: "당신의 문장을 오래된 책처럼 소중히 읽고 조용한 질문을 건네요.",
    greeting: "오늘의 문장을 이곳에 맡겨주세요. 서두르지 않고 읽겠습니다.",
    mark: "해",
  },
];

export const emotions: EmotionScore[] = [
  { label: "안도", score: 72, color: "sage" },
  { label: "그리움", score: 58, color: "blue" },
  { label: "긴장", score: 31, color: "rose" },
  { label: "기쁨", score: 44, color: "amber" },
];
