import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import { signInWithGoogle, signOut, subscribeToAuth } from "../lib/auth";
import {
  createEvent,
  deleteEvent,
  subscribeToMyEvents,
  updateEventStatus,
} from "../lib/events";
import type { Event, EventStatus } from "../types/models";

const NEW = "__new__";

const statusName: Record<EventStatus, string> = {
  draft: "Draft",
  active: "Live",
  ended: "Ended",
};

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

function joinUrl(code: string): string {
  return `${window.location.origin}/join/${code}`;
}

function formatDate(ts: { toDate: () => Date } | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return "—";
  return ts.toDate().toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusDot({ status }: { status: EventStatus }) {
  return <span className={`status-dot status-dot--${status}`} aria-hidden />;
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable in insecure contexts */
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function Sidebar({
  events,
  selectedId,
  onSelect,
}: {
  events: Event[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar__label">Events</div>
      <div className="sidebar__list">
        {events.length === 0 ? (
          <div className="sidebar__empty">No events. Press + to add one.</div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              role="button"
              tabIndex={0}
              className={`sidebar-item${
                selectedId === ev.id ? " sidebar-item--selected" : ""
              }`}
              onClick={() => onSelect(ev.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(ev.id);
                }
              }}
            >
              <StatusDot status={ev.status} />
              <span className="sidebar-item__title">{ev.title}</span>
              <span className="sidebar-item__sub">{ev.code}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function EmptyDetail({ hasEvents }: { hasEvents: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-state__title">
        {hasEvents ? "No event selected" : "No events yet"}
      </div>
      <div>
        {hasEvents
          ? "Pick an event from the sidebar."
          : "Press + in the toolbar to create your first event."}
      </div>
    </div>
  );
}

function NewEventForm({
  user,
  onCancel,
  onCreated,
}: {
  user: User;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [domains, setDomains] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const allowedDomains = domains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const id = await createEvent(user, title.trim(), allowedDomains);
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="detail__inner">
      <div className="detail__head">
        <h1 className="detail__title">New event</h1>
        <div className="detail__subtitle">A new draft event with a unique join code.</div>
      </div>
      <form onSubmit={submit} className="section" style={{ marginTop: "var(--space-6)" }}>
        <label className="field" style={{ marginBottom: "var(--space-4)" }}>
          Title
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="April 2026 all-hands"
          />
        </label>
        <label className="field">
          Allowed domains{" "}
          <span className="text-tertiary">(comma separated, blank = any)</span>
          <input
            className="input"
            type="text"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder={import.meta.env.VITE_ALLOWED_DOMAIN || "example.com"}
          />
        </label>
        <div className="row-flex" style={{ marginTop: "var(--space-5)" }}>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting || !title.trim()}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
          {error && (
            <span className="text-danger" style={{ fontSize: 13 }}>
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function EventDetail({
  event,
  onDeleted,
}: {
  event: Event;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = joinUrl(event.code);
  const presentUrl = `${window.location.origin}/present/${event.code}`;
  const openPresent = () => {
    window.open(presentUrl, "_blank", "noopener,noreferrer");
  };
  const next = nextStatus[event.status];
  const canDelete = event.status === "draft" || event.status === "ended";

  const advance = async () => {
    if (!next) return;
    setBusy(true);
    try {
      await updateEventStatus(event.id, next);
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      await updateEventStatus(event.id, "active");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Delete "${event.title}"? This removes all comments and reactions. This cannot be undone.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteEvent(event.id);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail__inner">
      <div className="detail__head">
        <h1 className="detail__title">{event.title}</h1>
        <div className="detail__subtitle">
          <StatusDot status={event.status} />
          <span>{statusName[event.status]}</span>
          <span className="text-tertiary">·</span>
          <span className="mono">{event.code}</span>
        </div>
      </div>

      <div className="detail__actions">
        {next && (
          <button className="btn btn--primary" onClick={advance} disabled={busy}>
            {nextLabel[event.status]}
          </button>
        )}
        {event.status === "ended" && (
          <button className="btn" onClick={reopen} disabled={busy}>
            Reopen
          </button>
        )}
        {canDelete && (
          <button className="btn btn--danger" onClick={remove} disabled={busy}>
            Delete
          </button>
        )}
      </div>

      <div className="section">
        <div className="section__label">Join</div>
        <div className="kv">
          <div className="kv__key">URL</div>
          <div className="kv__val">
            <a className="url-pill" href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
            <CopyButton value={url} label="Copy URL" />
          </div>
        </div>
        <div className="kv">
          <div className="kv__key">Code</div>
          <div className="kv__val">
            <span className="mono">{event.code}</span>
            <CopyButton value={event.code} label="Copy code" />
          </div>
        </div>
        <div className="kv">
          <div className="kv__key">QR</div>
          <div className="kv__val">
            <button
              type="button"
              className="qr-frame qr-frame--button"
              onClick={openPresent}
              title="Open join screen in new tab (for projecting)"
              aria-label="Open join screen in new tab"
            >
              <QRCodeSVG value={url} size={140} level="M" />
            </button>
            <button type="button" className="btn" onClick={openPresent}>
              Open join screen ↗
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section__label">Settings</div>
        <div className="kv">
          <div className="kv__key">Allowed domains</div>
          <div className="kv__val">
            {event.settings.allowedDomains.length > 0 ? (
              event.settings.allowedDomains.map((d) => (
                <span key={d} className="badge">
                  {d}
                </span>
              ))
            ) : (
              <span className="text-tertiary">Any (no restriction)</span>
            )}
          </div>
        </div>
        <div className="kv">
          <div className="kv__key">Anonymous names</div>
          <div className="kv__val">
            {event.settings.allowAnonymousName ? "Allowed" : "Disabled"}
          </div>
        </div>
        <div className="kv">
          <div className="kv__key">Comment speed</div>
          <div className="kv__val">{event.settings.commentSpeed}</div>
        </div>
        <div className="kv">
          <div className="kv__key">Font size</div>
          <div className="kv__val">{event.settings.fontSize}px</div>
        </div>
        <div className="kv">
          <div className="kv__key">Max concurrent</div>
          <div className="kv__val">{event.settings.maxConcurrent}</div>
        </div>
      </div>

      <div className="section">
        <div className="section__label">History</div>
        <div className="kv">
          <div className="kv__key">Created</div>
          <div className="kv__val">{formatDate(event.createdAt)}</div>
        </div>
        {event.startedAt && (
          <div className="kv">
            <div className="kv__key">Started</div>
            <div className="kv__val">{formatDate(event.startedAt)}</div>
          </div>
        )}
        {event.endedAt && (
          <div className="kv">
            <div className="kv__key">Ended</div>
            <div className="kv__val">{formatDate(event.endedAt)}</div>
          </div>
        )}
      </div>
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
            {error && (
              <p className="text-danger" style={{ fontSize: 13 }}>
                {error}
              </p>
            )}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (selectedId === NEW) return;
    if (events.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !events.some((ev) => ev.id === selectedId)) {
      setSelectedId(events[0].id);
    }
  }, [events, selectedId]);

  const selected = useMemo(
    () => events.find((ev) => ev.id === selectedId) ?? null,
    [events, selectedId]
  );

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

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
    <div className="window">
      <div className="titlebar">
        <div className="titlebar__group">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setSelectedId(NEW)}
            title="New event"
            aria-label="New event"
            disabled={selectedId === NEW}
          >
            +
          </button>
        </div>
        <div className="titlebar__spacer" />
        <div className="titlebar__group titlebar__group--right">
          <span className="titlebar__user" title={user.email ?? undefined}>
            {user.displayName ?? user.email}
          </span>
          <button
            type="button"
            className="toolbar-btn toolbar-btn--text"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="window__body">
        <Sidebar
          events={events}
          selectedId={selectedId === NEW ? null : selectedId}
          onSelect={setSelectedId}
        />
        <main className="detail">
          {selectedId === NEW && user ? (
            <NewEventForm
              user={user}
              onCancel={() => setSelectedId(events[0]?.id ?? null)}
              onCreated={(id) => setSelectedId(id)}
            />
          ) : selected ? (
            <EventDetail
              event={selected}
              onDeleted={() => setSelectedId(events[0]?.id ?? null)}
            />
          ) : (
            <EmptyDetail hasEvents={events.length > 0} />
          )}
        </main>
      </div>
    </div>
  );
}
