import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { User } from "firebase/auth";
import { findEventByCode } from "../lib/events";
import { subscribeToComments } from "../lib/comments";
import { signInWithGoogle, subscribeToAuth } from "../lib/auth";
import type { Comment, Event } from "../types/models";

interface RankedUser {
  uid: string;
  name: string;
  email: string;
  count: number;
}

function initials(name: string): string {
  const source = name.trim();
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function rank(comments: Comment[]): RankedUser[] {
  const map = new Map<string, RankedUser>();
  // newest comments first so each authorUid keeps their latest displayName
  const sorted = [...comments].sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  for (const c of sorted) {
    if (!c.authorUid) continue;
    const existing = map.get(c.authorUid);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(c.authorUid, {
        uid: c.authorUid,
        name: c.author || c.authorEmail || "Unknown",
        email: c.authorEmail || "",
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

const PALETTE = [
  "linear-gradient(135deg, #ff6ec4 0%, #7873f5 100%)",
  "linear-gradient(135deg, #ffa17f 0%, #00223e 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
  "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
];

function avatarColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function formatRank(n: number): string {
  return `#${String(n).padStart(3, "0")}`;
}

function LeaderboardView({ event }: { event: Event }) {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => subscribeToComments(event.id, setComments), [event.id]);

  const ranked = useMemo(() => rank(comments), [comments]);
  const totalComments = comments.length;
  const totalParticipants = ranked.length;

  return (
    <div className="leaderboard-page__inner">
      <header className="leaderboard-page__header">
        <div className="leaderboard-page__title">{event.title}</div>
        <div className="leaderboard-page__stats">
          <div className="leaderboard-stat">
            <div className="leaderboard-stat__value">
              {totalComments.toLocaleString()}
            </div>
            <div className="leaderboard-stat__label">Total comments</div>
          </div>
          <div className="leaderboard-stat__divider" aria-hidden />
          <div className="leaderboard-stat">
            <div className="leaderboard-stat__value">
              {totalParticipants.toLocaleString()}
            </div>
            <div className="leaderboard-stat__label">Participants</div>
          </div>
        </div>
      </header>

      <section className="leaderboard-section">
        <div className="leaderboard-section__label">Top contributors</div>
        {ranked.length === 0 ? (
          <div className="leaderboard-empty">
            Waiting for the first comment…
          </div>
        ) : (
          <ol className="leaderboard-list">
            {ranked.map((u, i) => (
              <li key={u.uid} className="leaderboard-row">
                <div className="leaderboard-row__rank">{formatRank(i + 1)}</div>
                <div
                  className="leaderboard-row__avatar"
                  style={{ background: avatarColor(u.uid) }}
                >
                  {initials(u.name)}
                </div>
                <div className="leaderboard-row__identity">
                  <div className="leaderboard-row__name">{u.name}</div>
                  <div className="leaderboard-row__email">{u.email}</div>
                </div>
                <div className="leaderboard-row__count">
                  <span className="leaderboard-row__count-num">{u.count}</span>
                  <span className="leaderboard-row__count-unit">
                    {u.count === 1 ? "comment" : "comments"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default function Leaderboard() {
  const { code } = useParams<{ code: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToAuth((u) => {
    setUser(u);
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!user || !code) return;
    let cancelled = false;
    findEventByCode(code)
      .then((ev) => {
        if (cancelled) return;
        if (!ev) setError("Event not found");
        else setEvent(ev);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [user, code]);

  useEffect(() => {
    document.body.classList.add("leaderboard-page-body");
    return () => document.body.classList.remove("leaderboard-page-body");
  }, []);

  let content: React.ReactNode;
  if (authLoading) {
    content = <div className="leaderboard-page__notice">Loading…</div>;
  } else if (!user) {
    content = (
      <div className="leaderboard-page__notice">
        <div className="leaderboard-page__notice-title">Sign in required</div>
        <button
          type="button"
          className="btn btn--primary btn--large"
          onClick={() => signInWithGoogle().catch(() => {})}
        >
          Sign in with Google
        </button>
      </div>
    );
  } else if (error) {
    content = <div className="leaderboard-page__notice">{error}</div>;
  } else if (!event || !code) {
    content = null;
  } else {
    content = <LeaderboardView event={event} />;
  }

  return (
    <div className="leaderboard-page">
      {content}
      <div className="leaderboard-page__brand">Tsudoi</div>
    </div>
  );
}
