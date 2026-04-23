import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import { signInWithGoogle, signOut, subscribeToAuth } from "../lib/auth";
import { createEvent, subscribeToMyEvents, updateEventStatus } from "../lib/events";
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
  draft: "Start event",
  active: "End event",
  ended: "",
};

function EventItem({ event }: { event: Event }) {
  const [showQR, setShowQR] = useState(false);
  const next = nextStatus[event.status];
  const url = joinUrl(event.code);

  return (
    <li
      style={{
        border: "1px solid #ddd",
        borderRadius: 6,
        padding: "0.75rem 1rem",
        marginBottom: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <div>
          <strong>{event.title}</strong>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            code: <code>{event.code}</code> · status: {event.status}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setShowQR((v) => !v)}>
            {showQR ? "Hide QR" : "Show QR"}
          </button>
          {next && (
            <button onClick={() => updateEventStatus(event.id, next)}>
              {nextLabel[event.status]}
            </button>
          )}
        </div>
      </div>
      {showQR && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <QRCodeSVG value={url} size={200} level="M" />
          <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", wordBreak: "break-all" }}>
            <a href={url}>{url}</a>
          </div>
        </div>
      )}
    </li>
  );
}

function EventList({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p style={{ color: "#666" }}>No events yet.</p>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {events.map((ev) => (
        <EventItem key={ev.id} event={ev} />
      ))}
    </ul>
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
    <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        <label>
          Title:
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            style={{ marginLeft: "0.5rem", width: "20rem" }}
          />
        </label>
      </div>
      <div style={{ marginBottom: "0.5rem" }}>
        <label>
          Allowed domains (comma-separated, blank = any):
          <input
            type="text"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder="youtrust.jp"
            style={{ marginLeft: "0.5rem", width: "20rem" }}
          />
        </label>
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create event"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    return subscribeToMyEvents(user.uid, setEvents);
  }, [user]);

  const handleSignIn = async () => {
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1>Tsudoi Admin</h1>
      {user ? (
        <>
          <p>
            Signed in as {user.displayName} ({user.email}){" "}
            <button onClick={() => signOut()}>Sign out</button>
          </p>
          <h2>Create event</h2>
          <CreateEventForm user={user} />
          <h2>Your events</h2>
          <EventList events={events} />
        </>
      ) : (
        <>
          <button onClick={handleSignIn}>Sign in with Google</button>
          {signInError && <p style={{ color: "crimson" }}>{signInError}</p>}
        </>
      )}
    </main>
  );
}
