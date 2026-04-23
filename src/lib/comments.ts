import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";

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
