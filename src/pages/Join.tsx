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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await postComment(event.id, user, trimmed, color);
      setText("");
      setJustSent(true);
      setTimeout(() => setJustSent(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (event.status !== "active") {
    return (
      <p style={{ color: "#666" }}>
        This event is {event.status}. Comments can only be posted while active.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
        placeholder="Write a comment…"
        autoFocus
        enterKeyHint="send"
        style={{
          width: "100%",
          padding: "0.75rem",
          fontSize: "1rem",
          borderRadius: 8,
          border: "1px solid #ccc",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {COMMENT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: c,
              border: color === c ? "3px solid #1d1d1f" : "1px solid #ccc",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <button
        type="submit"
        disabled={submitting || !text.trim()}
        style={{
          padding: "0.75rem",
          fontSize: "1rem",
          fontWeight: 500,
          background: "#0071e3",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: submitting || !text.trim() ? "not-allowed" : "pointer",
          opacity: submitting || !text.trim() ? 0.6 : 1,
        }}
      >
        {submitting ? "Sending…" : "Send"}
      </button>
      <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "right" }}>
        {text.length}/200
      </div>
      {justSent && <p style={{ color: "#34c759" }}>Sent!</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
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

  const pageStyle: React.CSSProperties = {
    padding: "1.5rem",
    maxWidth: 480,
    margin: "0 auto",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  };

  if (authLoading) return <main style={pageStyle}><p>Loading…</p></main>;

  if (!user) {
    return (
      <main style={pageStyle}>
        <h1>Join event</h1>
        <p>Code: <code>{eventCode}</code></p>
        <button
          onClick={() => signInWithGoogle().catch(() => {})}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            background: "#0071e3",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  if (eventLoading) return <main style={pageStyle}><p>Looking up event…</p></main>;

  if (notFound) {
    return (
      <main style={pageStyle}>
        <h1>Event not found</h1>
        <p>The code <code>{eventCode}</code> didn't match any event.</p>
      </main>
    );
  }

  if (lookupError) {
    return (
      <main style={pageStyle}>
        <h1>Error</h1>
        <p style={{ color: "crimson" }}>{lookupError}</p>
      </main>
    );
  }

  if (!event) return null;

  return (
    <main style={pageStyle}>
      <h1 style={{ marginBottom: "0.25rem" }}>{event.title}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Signed in as {user.displayName}</p>
      <CommentForm event={event} user={user} />
    </main>
  );
}
