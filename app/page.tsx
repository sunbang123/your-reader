"use client";

import { useMemo, useState } from "react";
import { emotions, personas, type PersonaId } from "../lib/models";

type View = "persona" | "editor" | "result" | "library";

const sampleText = "오랜만에 아무 약속도 없는 저녁이었다. 창문을 조금 열어두니 비 냄새가 방 안으로 들어왔다. 해야 할 일은 남아 있었지만, 오늘만큼은 가만히 있어도 괜찮다는 생각이 들었다.";

export default function Home() {
  const [view, setView] = useState<View>("persona");
  const [personaId, setPersonaId] = useState<PersonaId>("listener");
  const [text, setText] = useState(sampleText);
  const [soundOn, setSoundOn] = useState(true);
  const persona = useMemo(() => personas.find((item) => item.id === personaId)!, [personaId]);

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setView("persona")}>YOUR READER</button>
        <nav aria-label="주요 메뉴">
          <button className={view === "library" ? "active" : ""} onClick={() => setView("library")}>나의 서재</button>
          <button className="avatar" aria-label="프로필">윤</button>
        </nav>
      </header>

      {view === "persona" && (
        <section className="page persona-page">
          <p className="eyebrow">오늘 당신의 글을 읽어줄 사람</p>
          <h1>어떤 독자에게<br />마음을 건넬까요?</h1>
          <p className="lede">지금 필요한 방식으로 당신의 문장을 읽어줄 한 사람을 골라보세요.</p>
          <div className="persona-grid">
            {personas.map((item) => (
              <button key={item.id} className={`persona-card ${personaId === item.id ? "selected" : ""}`} onClick={() => setPersonaId(item.id)}>
                <span className="persona-mark">{item.mark}</span>
                <span className="persona-role">{item.role}</span>
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                <small>“{item.greeting}”</small>
              </button>
            ))}
          </div>
          <button className="primary" onClick={() => setView("editor")}>{persona.name}에게 글쓰기 <span>→</span></button>
        </section>
      )}

      {view === "editor" && (
        <section className="editor-page">
          <aside className="reader-note">
            <span className="persona-mark">{persona.mark}</span>
            <p className="eyebrow">{persona.role} · {persona.name}</p>
            <blockquote>“{persona.greeting}”</blockquote>
            <button className={`sound ${soundOn ? "on" : ""}`} onClick={() => setSoundOn(!soundOn)}>
              <span className="sound-bars">▮▮▮</span> 빗소리 {soundOn ? "켜짐" : "꺼짐"}
            </button>
          </aside>
          <div className="writing-sheet">
            <div className="writing-meta"><span>2026년 7월 16일 목요일</span><span>{text.length}자</span></div>
            <input className="title-input" defaultValue="비가 오던 저녁" aria-label="글 제목" />
            <textarea value={text} onChange={(event) => setText(event.target.value)} aria-label="글 내용" placeholder="지금 떠오르는 마음을 적어보세요." />
            <div className="editor-actions">
              <button className="secondary" onClick={() => setView("persona")}>독자 바꾸기</button>
              <button className="primary" disabled={!text.trim()} onClick={() => setView("result")}>글을 읽어주세요 <span>→</span></button>
            </div>
          </div>
        </section>
      )}

      {view === "result" && (
        <section className="page result-page">
          <p className="eyebrow">{persona.name}이 천천히 읽어보았어요</p>
          <h1>문장 사이에서<br />이런 마음을 만났어요.</h1>
          <div className="result-grid">
            <article className="emotion-panel">
              <h2>마음의 결</h2>
              <p>고요함 속에서 스스로에게 잠시 쉬어도 된다고 허락하는 마음이 가장 크게 느껴졌어요.</p>
              <div className="emotion-list">
                {emotions.map((emotion) => (
                  <div className="emotion" key={emotion.label}>
                    <div><span>{emotion.label}</span><strong>{emotion.score}%</strong></div>
                    <div className="track"><span className={emotion.color} style={{ width: `${emotion.score}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
            <article className="letter">
              <div className="letter-head"><span className="persona-mark">{persona.mark}</span><div><small>{persona.role}</small><strong>{persona.name}의 답장</strong></div></div>
              <p>아무 약속도 없는 저녁이 오히려 당신에게 작은 약속을 건넨 것 같아요. 오늘만큼은 가만히 있어도 괜찮다고요.</p>
              <p>특히 “비 냄새가 방 안으로 들어왔다”는 문장에서 오래 머물렀어요. 바깥의 계절이 조용히 당신의 마음까지 들어와 굳어 있던 긴장을 풀어주는 장면처럼 느껴졌거든요.</p>
              <p className="signature">당신의 문장을 읽은, {persona.name}</p>
            </article>
          </div>
          <div className="result-actions"><button className="secondary" onClick={() => setView("editor")}>다시 쓰기</button><button className="primary" onClick={() => setView("library")}>서재에 보관하기</button></div>
        </section>
      )}

      {view === "library" && (
        <section className="page library-page">
          <div className="library-heading"><div><p className="eyebrow">나만의 문장 보관함</p><h1>나의 서재</h1><p className="lede">쓰고, 읽히고, 조금씩 알아간 마음이 모이는 곳이에요.</p></div><button className="primary" onClick={() => setView("persona")}>새 글 쓰기</button></div>
          <div className="summary-card"><div><span>이번 달 기록</span><strong>7편</strong></div><div><span>가장 자주 만난 마음</span><strong>안도</strong></div><div><span>함께한 독자</span><strong>3명</strong></div></div>
          <div className="entry-grid">
            {["비가 오던 저녁", "조금 느린 월요일", "낯선 도시의 창문"].map((title, index) => (
              <article className="entry-card" key={title}>
                <div className="entry-meta"><span>7월 {16 - index * 3}일</span><span>{index === 1 ? "그리움" : "안도"}</span></div>
                <h2>{title}</h2>
                <p>{index === 0 ? sampleText : "천천히 적어 내려간 문장 속에서 그날의 마음을 다시 만났습니다."}</p>
                <div className="entry-reader"><span className="persona-mark">{personas[index].mark}</span><span>{personas[index].name}이 읽음</span><button onClick={() => setView("result")}>열어보기 →</button></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
