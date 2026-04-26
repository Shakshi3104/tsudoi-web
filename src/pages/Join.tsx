import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { User } from "firebase/auth";
import { signInWithGoogle, subscribeToAuth } from "../lib/auth";
import { findEventByCode } from "../lib/events";
import { postComment } from "../lib/comments";
import type { Event } from "../types/models";
import UserMenu from "../components/UserMenu";

const COMMENT_COLORS = [
  "#1d1d1f",
  "#0071e3",
  "#34c759",
  "#ff3b30",
  "#ff9500",
  "#af52de",
];

interface SentMessage {
  id: number;
  text: string;
  color: string;
}

function CommentScreen({ event, user }: { event: Event; user: User }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(COMMENT_COLORS[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SentMessage[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history.length]);

  const send = async (body: string, sendColor: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await postComment(event.id, user, body, sendColor);
      counterRef.current += 1;
      setHistory((prev) => [
        ...prev.filter((m) => m.text !== body),
        { id: counterRef.current, text: body, color: sendColor },
      ]);
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
    await send(trimmed, color);
    setText("");
  };

  if (event.status !== "active") {
    const message =
      event.status === "draft"
        ? "This event hasn't started yet."
        : "This event has ended.";
    return (
      <div className="join-screen join-screen--empty">
        <div className="join-empty__title">{event.title}</div>
        <div className="join-empty__message">{message}</div>
        <Link to="/" className="btn btn--primary btn--large">
          Back to home
        </Link>
      </div>
    );
  }

  const canSend = !submitting && text.trim().length > 0;

  return (
    <div className="join-screen">
      <header className="join-header">
        <div className="join-header__main">
          <h1 className="join-header__title">{event.title}</h1>
          <div className="join-header__meta">
            <span className="status-dot status-dot--active" aria-hidden />
            <span>Live</span>
          </div>
        </div>
        <UserMenu user={user} />
      </header>

      <div className="join-feed" ref={feedRef}>
        {history.length === 0 ? (
          <div className="join-feed__empty">
            <div className="join-feed__empty-title">Send your first comment</div>
            <div className="join-feed__empty-sub">
              It will appear on the projector screen.
            </div>
          </div>
        ) : (
          <ul className="join-bubbles">
            {history.map((msg) => (
              <li key={msg.id} className="join-bubble-row">
                <button
                  type="button"
                  className="join-bubble"
                  style={{ background: msg.color }}
                  onClick={() => send(msg.text, msg.color)}
                  disabled={submitting}
                  title="Send again"
                >
                  {msg.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        {error && <div className="composer__error">{error}</div>}
        <div className="composer__colors" role="radiogroup" aria-label="Comment color">
          {COMMENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              className={`composer__color${color === c ? " composer__color--selected" : ""}`}
              onClick={() => setColor(c)}
              style={{ background: c }}
            />
          ))}
          <span className="composer__counter" aria-live="polite">
            {text.length}/200
          </span>
        </div>
        <div className="composer__row">
          <input
            className="composer__input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="Message"
            autoFocus
            enterKeyHint="send"
            inputMode="text"
          />
          <button
            type="submit"
            className="composer__send"
            disabled={!canSend}
            style={{ background: canSend ? color : undefined }}
            aria-label="Send comment"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path
                d="M5 12 L19 12 M13 6 L19 12 L13 18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="gate">
      <div className="gate__inner">{children}</div>
    </main>
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

  useEffect(
    () =>
      subscribeToAuth((u) => {
        setUser(u);
        setAuthLoading(false);
      }),
    []
  );

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
      <CenteredCard>
        <p className="text-secondary">Loading…</p>
      </CenteredCard>
    );
  }

  if (!user) {
    return (
      <CenteredCard>
        <h1 className="gate__title">Join event</h1>
        <p className="text-secondary gate__sub">
          Code <code>{eventCode}</code>
        </p>
        <button
          className="btn btn--primary btn--large gate__cta"
          onClick={() => signInWithGoogle().catch(() => {})}
        >
          Sign in with Google
        </button>
      </CenteredCard>
    );
  }

  if (eventLoading) {
    return (
      <CenteredCard>
        <p className="text-secondary">Looking up event…</p>
      </CenteredCard>
    );
  }

  if (notFound) {
    return (
      <CenteredCard>
        <h1 className="gate__title">Event not found</h1>
        <p className="text-secondary gate__sub">
          The code <code>{eventCode}</code> didn't match any event.
        </p>
        <Link to="/" className="btn btn--primary btn--large gate__cta">
          Back to home
        </Link>
      </CenteredCard>
    );
  }

  if (lookupError) {
    return (
      <CenteredCard>
        <h1 className="gate__title">Error</h1>
        <p className="text-danger gate__sub">{lookupError}</p>
        <Link to="/" className="btn btn--primary btn--large gate__cta">
          Back to home
        </Link>
      </CenteredCard>
    );
  }

  if (!event) return null;

  return <CommentScreen event={event} user={user} />;
}
