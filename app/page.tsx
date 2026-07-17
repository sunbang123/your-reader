"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent, Session, User, UserResponse } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

type Entry = {
  id: string;
  title: string;
  body: string;
  updated_at: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const lastSaved = useRef({ title: "", body: "" });

  const loadEntries = useCallback(async (owner: User) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("entries")
      .select("id,title,body,updated_at")
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
    });
    return () => data.subscription.unsubscribe();
  }, [loadEntries]);

  useEffect(() => {
    if (!user || (title === lastSaved.current.title && body === lastSaved.current.body)) return;
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const values = { title, body, user_id: user.id, persona_id: "listener", status: "draft" };
      const result = entryId
        ? await supabase.from("entries").update(values).eq("id", entryId).select("id,title,body,updated_at").single()
        : await supabase.from("entries").insert(values).select("id,title,body,updated_at").single();
      if (result.error || !result.data) {
        setSaveState("error");
        return;
      }
      const saved = result.data as Entry;
      setEntryId(saved.id);
      lastSaved.current = { title, body };
      setSaveState("saved");
      void loadEntries(user);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [body, entryId, loadEntries, title, user]);

  function openEntry(entry: Entry) {
    setEntryId(entry.id);
    setTitle(entry.title);
    setBody(entry.body);
    lastSaved.current = { title: entry.title, body: entry.body };
    setSaveState("saved");
  }

  function newEntry() {
    setEntryId(null);
    setTitle("");
    setBody("");
    lastSaved.current = { title: "", body: "" };
    setSaveState("idle");
  }

  async function removeEntry(id: string) {
    if (!window.confirm("이 글을 삭제할까요?")) return;
    await createClient().from("entries").delete().eq("id", id);
    if (entryId === id) newEntry();
    if (user) void loadEntries(user);
  }

  if (!isSupabaseConfigured) return <Setup />;
  if (loading) return <main className="center">불러오는 중…</main>;
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
                <span>{new Date(entry.updated_at).toLocaleDateString("ko-KR")}</span>
              </button>
              <button className="delete" onClick={() => void removeEntry(entry.id)} aria-label="글 삭제">×</button>
            </div>
          ))}
        </div>
        <button className="signout" onClick={() => void createClient().auth.signOut()}>로그아웃</button>
      </aside>
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
        <div className="paper">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" aria-label="글 제목" maxLength={160} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="지금 떠오르는 마음을 천천히 적어보세요…" aria-label="글 내용" maxLength={50000} autoFocus />
        </div>
      </section>
    </main>
  );
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
      : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("이메일의 확인 링크를 눌러 가입을 완료해 주세요.");
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <p className="brand-label">YOUR READER</p>
        <h1>{mode === "login" ? "다시 만나요" : "당신의 서재를 만들어요"}</h1>
        <p>생각이 사라지기 전에, 조용히 문장으로 남겨보세요.</p>
        <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary" type="submit">{mode === "login" ? "로그인" : "회원가입"}</button>
        <button className="text-button" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "처음이신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
      </form>
    </main>
  );
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
