import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import { signInWithGoogle, signOut, subscribeToAuth } from "../lib/auth";
import { createEvent, deleteEvent, subscribeToMyEvents, updateEventStatus } from "../lib/events";
import type { Event, EventStatus } from "../types/models";

function joinUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

const nextStatus: Record<EventStatus, EventStatus | null> = {
  draft: "active",
  active: "ended",
  ended: null,
};

const nextLabel: Record<EventStatus, string> = {
  draft: "Start",
  active: "End",
  ended: "",
};

const statusBadgeClass: Record<EventStatus, string> = {
  draft: "badge badge--draft",
  active: "badge badge--active",
  ended: "badge badge--ended",
};

function EventItem({ event }: { event: Event }) {
  const [showQR, setShowQR] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = nextStatus[event.status];
  const url = joinUrl(event.code);

  const canDelete = event.status === "draft" || event.status === "ended";

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This removes all comments and reactions. This cannot be undone.`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteEvent(event.id);
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    setBusy(true);
    try {
      await updateEventStatus(event.id, "active");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div className="row-flex">
        <div className="row__main">
          <div className="row__title">{event.title}</div>
          <div className="row__meta">
            <span className={statusBadgeClass[event.status]}>{event.status}</span>
            {" · "}
            code <code>{event.code}</code>
          </div>
        </div>
        <div className="row__actions">
          <button className="btn" onClick={() => setShowQR((v) => !v)} disabled={busy}>
            {showQR ? "Hide QR" : "Show QR"}
          </button>
          {event.status === "ended" && (
            <button className="btn" onClick={handleReopen} disabled={busy}>
              Reopen
            </button>
          )}
          {next && (
            <button
              className="btn btn--primary"
              onClick={() => updateEventStatus(event.id, next)}
              disabled={busy}
            >
              {nextLabel[event.status]}
            </button>
          )}
          {canDelete && (
            <button className="btn btn--danger" onClick={handleDelete} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </div>
      {showQR && (
        <div
          style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-5)",
            background: "var(--surface-muted)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ background: "#ffffff", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
            <QRCodeSVG value={url} size={200} level="M" />
          </div>
          <a href={url} className="row__meta" style={{ wordBreak: "break-all", textAlign: "center" }}>
            {url}
          </a>
        </div>
      )}
    </div>
  );
}

function EventList({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-secondary">No events yet. Create one above.</p>;
  }
  return (
    <div className="row-list">
      {events.map((ev) => (
        <EventItem key={ev.id} event={ev} />
      ))}
    </div>
  );
}

function CreateEventForm({ user }: { user: User }) {
  const [title, setTitle] = useState("");
  const [domains, setDomains] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const allowedDomains = domains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      await createEvent(user, title.trim(), allowedDomains);
      setTitle("");
      setDomains("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit} className="stack">
        <label className="field">
          Title
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            placeholder="April 2026 all-hands"
          />
        </label>
        <label className="field">
          Allowed domains <span className="text-tertiary">(comma separated, blank = any)</span>
          <input
            className="input"
            type="text"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder={import.meta.env.VITE_ALLOWED_DOMAIN || "example.com"}
          />
        </label>
        <div className="row-flex">
          <button type="submit" className="btn btn--primary" disabled={submitting || !title.trim()}>
            {submitting ? "Creating…" : "Create event"}
          </button>
          {error && <span className="text-danger" style={{ fontSize: 13 }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const PASS_STORAGE_KEY = "tsudoi.admin-pass";

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      sessionStorage.setItem(PASS_STORAGE_KEY, "1");
      onUnlock();
    } else {
      setError("Incorrect password");
    }
  };

  return (
    <main className="app-shell">
      <div className="app-container app-container--narrow" style={{ textAlign: "center" }}>
        <h1>Tsudoi Admin</h1>
        <form onSubmit={submit} className="card" style={{ marginTop: "var(--space-5)" }}>
          <div className="stack">
            <label className="field" style={{ textAlign: "left" }}>
              Password
              <input
                className="input"
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn--primary btn--large" disabled={!input}>
              Continue
            </button>
            {error && <p className="text-danger" style={{ fontSize: 13 }}>{error}</p>}
          </div>
        </form>
      </div>
    </main>
  );
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (!ADMIN_PASSWORD) return true;
    return sessionStorage.getItem(PASS_STORAGE_KEY) === "1";
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    return subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, [unlocked]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    return subscribeToMyEvents(user.uid, setEvents);
  }, [user]);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return (
      <main className="app-shell">
        <div className="app-container">
          <p className="text-secondary">Loading…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell">
        <div className="app-container app-container--narrow">
          <h1>Tsudoi Admin</h1>
          <p className="text-secondary" style={{ marginTop: "var(--space-2)" }}>
            Create and manage events.
          </p>
          <div className="card" style={{ marginTop: "var(--space-5)", textAlign: "center" }}>
            <button className="btn btn--primary btn--large" onClick={handleSignIn}>
              Sign in with Google
            </button>
            {signInError && (
              <p className="text-danger" style={{ marginTop: "var(--space-3)", fontSize: 13 }}>
                {signInError}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <header className="row-flex" style={{ marginBottom: "var(--space-5)" }}>
          <h1>Tsudoi Admin</h1>
          <div className="spacer" />
          <div className="row-flex">
            <span className="text-secondary" style={{ fontSize: 13 }}>
              {user.displayName ?? user.email}
            </span>
            <button className="btn" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </header>

        <h2 className="section-title">Create event</h2>
        <CreateEventForm user={user} />

        <h2 className="section-title">Your events</h2>
        <EventList events={events} />
      </div>
    </main>
  );
}
