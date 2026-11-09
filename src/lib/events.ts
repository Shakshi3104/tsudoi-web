import {
  collection,
  setDoc,
  serverTimestamp,
  query,
  where,
  or,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { Event, EventSettings, EventStatus } from "../types/models";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 10;

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

const DEFAULT_SETTINGS: EventSettings = {
  allowedDomains: [],
  allowAnonymousName: false,
  commentSpeed: 5,
  fontSize: 48,
  maxConcurrent: 50,
  ngWords: [],
};

export async function createEvent(
  user: User,
  title: string,
  allowedDomains: string[] = []
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    const ref = doc(db, "events", code);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;
    await setDoc(ref, {
      code,
      title,
      status: "draft",
      createdBy: user.uid,
      ownerDomain: emailDomain(user),
      createdAt: serverTimestamp(),
      settings: { ...DEFAULT_SETTINGS, allowedDomains },
    });
    return code;
  }
  throw new Error("Could not generate a unique event code. Try again.");
}

function emailDomain(user: User): string {
  return (user.email ?? "").split("@")[1]?.toLowerCase() ?? "";
}

// Domains whose members co-manage each other's events. Set per deployment in
// config/adminSharing; absent means each organizer sees only their own events.
async function getSharedAdminDomains(): Promise<string[]> {
  const snap = await getDoc(doc(db, "config", "adminSharing"));
  const domains = snap.exists() ? snap.data().domains : undefined;
  return Array.isArray(domains) ? domains : [];
}

// Events created before ownerDomain existed are not visible to co-organizers
// until their creator stamps it.
function backfillOwnerDomain(user: User, events: Event[]): void {
  const domain = emailDomain(user);
  if (!domain) return;
  for (const ev of events) {
    if (ev.createdBy === user.uid && !ev.ownerDomain) {
      updateDoc(doc(db, "events", ev.id), { ownerDomain: domain }).catch(
        (e) => console.warn(`Could not set ownerDomain on ${ev.id}`, e)
      );
    }
  }
}

export function subscribeToAdminEvents(
  user: User,
  callback: (events: Event[]) => void
): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  const listen = (shared: boolean) => {
    const domain = emailDomain(user);
    const owner = where("createdBy", "==", user.uid);
    const q = shared
      ? query(
          collection(db, "events"),
          or(owner, where("ownerDomain", "==", domain)),
          orderBy("createdAt", "desc")
        )
      : query(collection(db, "events"), owner, orderBy("createdAt", "desc"));
    unsubscribe = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
      backfillOwnerDomain(user, events);
      callback(events);
    });
  };

  getSharedAdminDomains()
    .then((domains) => domains.includes(emailDomain(user)))
    .catch(() => false)
    .then((shared) => {
      if (!cancelled) listen(shared);
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function updateEventStatus(
  eventId: string,
  status: EventStatus
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "active") update.startedAt = serverTimestamp();
  if (status === "ended") update.endedAt = serverTimestamp();
  await updateDoc(doc(db, "events", eventId), update);
}

export async function updateEventTitle(
  eventId: string,
  title: string
): Promise<void> {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("Title must be between 1 and 100 characters.");
  }
  await updateDoc(doc(db, "events", eventId), { title: trimmed });
}

export async function findEventByCode(code: string): Promise<Event | null> {
  const ref = doc(db, "events", code.trim().toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Event;
}

async function deleteSubcollection(eventId: string, name: string): Promise<void> {
  const snap = await getDocs(collection(db, "events", eventId, name));
  while (snap.docs.length > 0) {
    const chunk = snap.docs.splice(0, 400);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteSubcollection(eventId, "comments");
  await deleteSubcollection(eventId, "reactions");
  await deleteDoc(doc(db, "events", eventId));
}
