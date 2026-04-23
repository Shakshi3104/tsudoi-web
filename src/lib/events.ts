import {
  collection,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
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
      createdAt: serverTimestamp(),
      settings: { ...DEFAULT_SETTINGS, allowedDomains },
    });
    return code;
  }
  throw new Error("Could not generate a unique event code. Try again.");
}

export function subscribeToMyEvents(
  uid: string,
  callback: (events: Event[]) => void
): () => void {
  const q = query(
    collection(db, "events"),
    where("createdBy", "==", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
    callback(events);
  });
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

export async function findEventByCode(code: string): Promise<Event | null> {
  const ref = doc(db, "events", code.trim().toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Event;
}
