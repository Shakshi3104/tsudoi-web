import type { Timestamp } from "firebase/firestore";

export type EventStatus = "draft" | "active" | "ended";

export type ReactionType = "heart" | "clap" | "fire";

export interface EventSettings {
  allowedDomains: string[];
  allowAnonymousName: boolean;
  commentSpeed: number;
  fontSize: number;
  maxConcurrent: number;
  ngWords: string[];
}

export interface Event {
  id: string;
  code: string;
  title: string;
  status: EventStatus;
  createdBy: string;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  settings: EventSettings;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  authorUid: string;
  authorEmail: string;
  color: string;
  createdAt: Timestamp;
  hidden?: boolean;
}

export interface Reaction {
  id: string;
  type: ReactionType;
  authorUid: string;
  createdAt: Timestamp;
}
