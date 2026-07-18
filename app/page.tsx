"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User, UserResponse } from "@supabase/supabase-js";
import type { AiResult, EmotionLabel } from "../lib/ai/contracts";
import { personas, type PersonaId } from "../lib/models";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

type Entry = {
  id: string;
  title: string;
  body: string;
  persona_id: PersonaId;
  status: "draft" | "queued" | "analyzing" | "completed" | "failed";
  updated_at: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";
type AnalysisState = "idle" | "loading" | "error";
type Snapshot = { title: string; body: string; personaId: PersonaId };

const emotionColors: Record<EmotionLabel, string> = {
  안도: "sage",
  그리움: "blue",
  긴장: "rose",
  기쁨: "amber",
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [personaId, setPersonaId] = useState<PersonaId>("listener");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [view, setView] = useState<"editor" | "result">("editor");
  const lastSaved = useRef<Snapshot>({ title: "", body: "", personaId: "listener" });

  const loadEntries = useCallback(async (owner: User) => {
    const { data } = await createClient()
      .from("entries")
      .select("id,title,body,persona_id,status,updated_at")
      .eq("user_id", owner.id)
      .order("updated_at", { ascending: false });
    setEntries((data as Entry[] | null) ?? []);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: UserResponse) => {
      setUser(data.user);
      if (data.user) void loadEntries(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadEntries(session.user);
      else setEntries([]);
    });
    return () => data.subscription.unsubscribe();
  }, [loadEntries]);

  const persistEntry = useCallback(async (status: Entry["status"] = "draft") => {
    if (!user || (!title.trim() && !body.trim())) return null;
    setSaveState("saving");
    const values = { title, body, user_id: user.id, persona_id: personaId, status };
    const query = entryId
      ? createClient().from("entries").update(values).eq("id", entryId)
      : createClient().from("entries").insert(values);
    const { data, error } = await query.select("id,title,body,persona_id,status,updated_at").single();
    if (error || !data) {
      setSaveState("error");
      return null;
    }
    const saved = data as Entry;
    setEntryId(saved.id);
    lastSaved.current = { title, body, personaId };
    setSaveState("saved");
    void loadEntries(user);
    return saved;
  }, [body, entryId, loadEntries, personaId, title, user]);

  useEffect(() => {
    const snapshot = lastSaved.current;
    if (!user || analysisState === "loading" || (!title.trim() && !body.trim()) ||
      (title === snapshot.title && body === snapshot.body && personaId === snapshot.personaId)) return;
    const timer = window.setTimeout(() => void persistEntry("draft"), 800);
    return () => window.clearTimeout(timer);
  }, [analysisState, body, persistEntry, personaId, title, user]);

  async function loadResult(id: string) {
    setAnalysisState("loading");
    setAnalysisError("");
    const response = await fetch(`/api/entries/${id}/result`, { cache: "no-store" });
    const payload = await response.json() as { result?: AiResult; error?: string };
    if (response.ok && payload.result) {
      setResult(payload.result);
      setView("result");
      setAnalysisState("idle");
      return;
    }
    setAnalysisState("idle");
    setAnalysisError(payload.error ?? "결과를 불러오지 못했습니다.");
  }

  function openEntry(entry: Entry) {
    setEntryId(entry.id);
    setTitle(entry.title);
    setBody(entry.body);
    setPersonaId(entry.persona_id);
    lastSaved.current = { title: entry.title, body: entry.body, personaId: entry.persona_id };
    setSaveState("saved");
    setAnalysisError("");
    setResult(null);
    setView("editor");
    if (entry.status === "completed") void loadResult(entry.id);
  }

  function newEntry() {
    setEntryId(null);
    setTitle("");
    setBody("");
    setPersonaId("listener");
    lastSaved.current = { title: "", body: "", personaId: "listener" };
    setSaveState("idle");
    setAnalysisState("idle");
    setAnalysisError("");
    setResult(null);
    setView("editor");
  }

  async function removeEntry(id: string) {
    if (!window.confirm("이 글과 분석 결과를 함께 삭제할까요?")) return;
    await createClient().from("entries").delete().eq("id", id);
    if (entryId === id) newEntry();
    if (user) void loadEntries(user);
  }

  async function analyze() {
    if (body.trim().length < 20) {
      setAnalysisState("error");
      setAnalysisError("마음을 읽으려면 본문을 20자 이상 적어 주세요.");
      return;
    }
    setAnalysisState("loading");
    setAnalysisError("");
    const saved = await persistEntry("queued");
    if (!saved) {
      setAnalysisState("error");
      setAnalysisError("글을 먼저 저장하지 못했습니다. 연결을 확인해 주세요.");
      return;
    }
    const response = await fetch(`/api/entries/${saved.id}/analyze`, { method: "POST" });
    const payload = await response.json() as { result?: AiResult; error?: string };
    if (!response.ok || !payload.result) {
      setAnalysisState("error");
      setAnalysisError(payload.error ?? "분석을 완료하지 못했습니다.");
      if (user) void loadEntries(user);
      return;
    }
    setResult(payload.result);
    setAnalysisState("idle");
    setView("result");
    if (user) void loadEntries(user);
  }

  if (!isSupabaseConfigured) return <Setup />;
  if (loading) return <main className="center">서재를 여는 중…</main>;
  if (!user) return <Auth />;

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-head">
          <strong>YOUR READER</strong>
          <button className="icon-button" onClick={newEntry} aria-label="새 글">＋</button>
        </div>
        <button className="new-button" onClick={newEntry}>새 글 쓰기</button>
        <div className="entry-list">
          {entries.length === 0 && <p className="empty">첫 문장을 기다리고 있어요.</p>}
          {entries.map((entry) => (
            <div className={`entry-item ${entry.id === entryId ? "active" : ""}`} key={entry.id}>
              <button onClick={() => openEntry(entry)}>
                <strong>{entry.title || "제목 없는 글"}</strong>
                <span>{new Date(entry.updated_at).toLocaleDateString("ko-KR")} · {statusLabel(entry.status)}</span>
              </button>
              <button className="delete" onClick={() => void removeEntry(entry.id)} aria-label="글 삭제">×</button>
            </div>
          ))}
        </div>
        <button className="signout" onClick={() => void createClient().auth.signOut()}>로그아웃</button>
      </aside>

      {view === "result" && result ? (
        <ResultView result={result} title={title} body={body} onEdit={() => setView("editor")} onAnalyze={() => void analyze()} loading={analysisState === "loading"} />
      ) : (
        <section className="editor">
          <header className="editor-head">
            <span>{body.length.toLocaleString()}자</span>
            <span className={`save-state ${saveState}`}>
              {saveState === "saving" && "저장 중…"}
              {saveState === "saved" && "저장됨"}
              {saveState === "error" && "저장 실패 — 다시 입력해 주세요"}
              {saveState === "idle" && "글을 쓰면 자동 저장됩니다"}
            </span>
          </header>
          <div className="persona-strip" aria-label="독자 선택">
            <div className="persona-intro"><span>오늘의 독자</span><strong>{personas.find(({ id }) => id === personaId)?.name}</strong></div>
            <div className="persona-options">
              {personas.map((persona) => (
                <button className={persona.id === personaId ? "selected" : ""} key={persona.id} onClick={() => setPersonaId(persona.id)}>
                  <span className="persona-mark">{persona.mark}</span>
                  <span><strong>{persona.name}</strong><small>{persona.role}</small></span>
                </button>
              ))}
            </div>
          </div>
          <div className="paper">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" aria-label="글 제목" maxLength={160} />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="지금 떠오르는 마음을 천천히 적어보세요…" aria-label="글 내용" maxLength={50000} autoFocus />
            <div className="finish-row">
              <p>{personas.find(({ id }) => id === personaId)?.greeting}</p>
              <button className="analyze-button" onClick={() => void analyze()} disabled={analysisState === "loading"}>
                {analysisState === "loading" ? "마음을 읽는 중…" : "독자에게 건네기"}
              </button>
            </div>
            {analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function ResultView({ result, title, body, onEdit, onAnalyze, loading }: {
  result: AiResult;
  title: string;
  body: string;
  onEdit: () => void;
  onAnalyze: () => void;
  loading: boolean;
}) {
  const persona = personas.find(({ id }) => id === result.personaId) ?? personas[0];
  return (
    <section className="result-page">
      <header className="result-head">
        <div><p>READ BY {persona.name.toUpperCase()}</p><h1>{title || "제목 없는 글"}</h1></div>
        <div className="result-actions">
          <button onClick={onEdit}>글로 돌아가기</button>
          <button className="analyze-button" onClick={onAnalyze} disabled={loading}>{loading ? "다시 읽는 중…" : "다시 읽어달라고 하기"}</button>
        </div>
      </header>

      <div className="result-grid">
        <article className="result-card essay-card">
          <p className="eyebrow">마음에 남은 문장</p>
          <HighlightedEssay body={body} sentence={result.highlightedSentence} />
        </article>
        <aside className="result-card emotion-card">
          <p className="eyebrow">마음의 결</p>
          <h2>{result.dominantEmotion}</h2>
          <p>{result.summary}</p>
          <div className="emotion-bars">
            {result.emotions.map((emotion) => (
              <div className="emotion-row" key={emotion.emotion}>
                <span>{emotion.emotion}</span>
                <div><i className={emotionColors[emotion.emotion]} style={{ width: `${Math.round(emotion.score * 100)}%` }} /></div>
                <strong>{Math.round(emotion.score * 100)}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <article className="reader-letter">
        <div className="letter-persona"><span className="persona-mark large">{persona.mark}</span><div><p>{persona.role}</p><h2>{persona.name}의 답장</h2></div></div>
        <div className="letter-copy">{paragraphs(result.selectedComment)}</div>
      </article>

      <section className="penpal-section">
        <div className="penpal-title"><p className="eyebrow">LETTER ACROSS LANGUAGES</p><h2>Alex가 건넨 영어 편지</h2><p>당신의 문장과 Alex의 답장을 나란히 읽어보세요.</p></div>
        <div className="penpal-columns">
          <article><span>YOUR ESSAY · ENGLISH</span>{paragraphs(result.translationEn)}</article>
          <article><span>ALEX'S REPLY</span>{paragraphs(result.commentEn)}</article>
        </div>
      </section>
    </section>
  );
}

function HighlightedEssay({ body, sentence }: { body: string; sentence: string }) {
  const index = body.indexOf(sentence);
  if (index < 0) return <p className="essay-copy"><mark>{sentence}</mark></p>;
  return (
    <p className="essay-copy">
      {body.slice(0, index)}<mark>{sentence}</mark>{body.slice(index + sentence.length)}
    </p>
  );
}

function paragraphs(value: string) {
  return value.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={`${paragraph.slice(0, 20)}-${index}`}>{paragraph}</p>);
}

function statusLabel(status: Entry["status"]) {
  return { draft: "작성 중", queued: "읽기 대기", analyzing: "읽는 중", completed: "답장 도착", failed: "다시 시도 필요" }[status];
}

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (result.error) setMessage(authErrorMessage(result.error.message));
    else if (mode === "signup" && !result.data.session) setMessage("이메일의 확인 링크를 눌러 가입을 완료해 주세요.");
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <p className="brand-label">YOUR READER</p>
        <h1>{mode === "login" ? "다시 만나요" : "당신의 서재를 만들어요"}</h1>
        <p>생각이 사라지기 전에, 조용히 문장으로 남겨보세요.</p>
        <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary" type="submit">{mode === "login" ? "로그인" : "회원가입"}</button>
        <button className="text-button" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
      </form>
    </main>
  );
}

function authErrorMessage(message: string) {
  if (message.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (message.includes("Email rate limit exceeded") || message.includes("over_email_send_rate_limit")) return "인증 메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (message.includes("User already registered")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  return message;
}

function Setup() {
  return (
    <main className="auth-page">
      <section className="auth-card setup-card">
        <p className="brand-label">YOUR READER</p>
        <h1>Supabase 연결이 필요해요</h1>
        <p><code>.env.local</code>에 아래 두 값을 추가하면 인증과 자동 저장이 활성화됩니다.</p>
        <pre>NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...</pre>
      </section>
    </main>
  );
}
