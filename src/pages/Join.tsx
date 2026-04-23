import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { User } from "firebase/auth";
import { signInWithGoogle, subscribeToAuth } from "../lib/auth";
import { findEventByCode } from "../lib/events";
import { postComment } from "../lib/comments";
import type { Event } from "../types/models";

const COMMENT_COLORS = [
  "#1d1d1f",
  "#0071e3",
  "#34c759",
  "#ff3b30",
  "#ff9500",
  "#af52de",
];

function CommentForm({ event, user }: { event: Event; user: User }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(COMMENT_COLORS[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const send = async (body: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await postComment(event.id, user, body, color);
      setHistory((prev) => [body, ...prev.filter((m) => m !== body)].slice(0, 5));
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    await send(trimmed);
    setText("");
  };

  if (event.status !== "active") {
    return (
      <div className="card">
        <p className="text-secondary">
          This event is <strong>{event.status}</strong>. Comments can only be
          posted while active.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="stack">
        <input
          className="input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Write a comment…"
          autoFocus
          enterKeyHint="send"
          style={{ fontSize: 16 }}
        />
        <div className="row-flex" style={{ justifyContent: "space-between" }}>
          <div className="row-flex" style={{ gap: "var(--space-2)" }}>
            {COMMENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: c,
                  border: color === c ? "3px solid var(--text)" : "1px solid var(--border-strong)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            {text.length}/200
          </div>
        </div>
        <button
          type="submit"
          className="btn btn--primary btn--large"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "Sending…" : "Send"}
        </button>
        {justSent && <p className="text-success" style={{ fontSize: 13 }}>Sent</p>}
        {error && <p className="text-danger" style={{ fontSize: 13 }}>{error}</p>}
      </div>

      {history.length > 0 && (
        <>
          <hr className="divider" />
          <div className="stack stack--tight">
            <div className="text-secondary" style={{ fontSize: 12 }}>
              Recent — tap to resend
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {history.map((msg) => (
                <button
                  key={msg}
                  type="button"
                  onClick={() => send(msg)}
                  disabled={submitting}
                  className="btn"
                  style={{
                    borderRadius: "var(--radius-pill)",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </form>
  );
}

export default function Join() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => subscribeToAuth((u) => {
    setUser(u);
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!user || !eventCode) return;
    setEventLoading(true);
    findEventByCode(eventCode)
      .then((ev) => {
        if (ev) setEvent(ev);
        else setNotFound(true);
      })
      .catch((e) => setLookupError(e instanceof Error ? e.message : String(e)))
      .finally(() => setEventLoading(false));
  }, [user, eventCode]);

  if (authLoading) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow">
          <p className="text-secondary">Loading…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow" style={{ textAlign: "center" }}>
          <h1>Join event</h1>
          <p className="text-secondary" style={{ marginTop: "var(--space-2)" }}>
            Code <code>{eventCode}</code>
          </p>
          <div className="card" style={{ marginTop: "var(--space-5)" }}>
            <button
              className="btn btn--primary btn--large"
              onClick={() => signInWithGoogle().catch(() => {})}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (eventLoading) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow">
          <p className="text-secondary">Looking up event…</p>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow" style={{ textAlign: "center" }}>
          <h1>Event not found</h1>
          <p className="text-secondary" style={{ marginTop: "var(--space-2)" }}>
            The code <code>{eventCode}</code> didn't match any event.
          </p>
        </div>
      </main>
    );
  }

  if (lookupError) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow" style={{ textAlign: "center" }}>
          <h1>Error</h1>
          <p className="text-danger" style={{ marginTop: "var(--space-2)" }}>
            {lookupError}
          </p>
        </div>
      </main>
    );
  }

  if (!event) return null;

  return (
    <main className="app-shell">
      <div className="app-container app-container--narrow">
        <header style={{ marginBottom: "var(--space-5)" }}>
          <h1>{event.title}</h1>
          <p className="text-secondary" style={{ marginTop: "var(--space-1)" }}>
            Signed in as {user.displayName ?? user.email}
          </p>
        </header>
        <CommentForm event={event} user={user} />
      </div>
    </main>
  );
}
