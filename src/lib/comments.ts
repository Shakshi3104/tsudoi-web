import {
  collection,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import type { Comment } from "../types/models";

export async function postComment(
  eventId: string,
  user: User,
  text: string,
  color: string
): Promise<void> {
  await addDoc(collection(db, "events", eventId, "comments"), {
    text: text.trim(),
    author: user.displayName ?? "Anonymous",
    authorUid: user.uid,
    authorEmail: user.email,
    color,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToComments(
  eventId: string,
  callback: (comments: Comment[]) => void
): () => void {
  const q = query(collection(db, "events", eventId, "comments"));
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Comment, "id">),
    }));
    callback(comments);
  });
}
