# Firestore Schema

This document is the **single source of truth** for Tsudoi's Firestore data
model. The web app (`tsudoi-web`) and the macOS projection app (`tsudoi-macos`)
both conform to this schema.

**Schema version: 1.0.0**

If you change this schema, bump the version, update `src/types/models.ts`
in `tsudoi-web`, and open a companion PR in `tsudoi-macos` to keep the Swift
models in sync.

---

## Overview

```
events/{eventId}
├── comments/{commentId}
└── reactions/{reactionId}
```

- `events` is a top-level collection.
- `comments` and `reactions` are subcollections under each event.
- There are no other top-level collections in MVP.

---

## `events/{eventId}`

One document per live session.

| Field        | Type       | Required | Notes                                                                  |
| ------------ | ---------- | -------- | ---------------------------------------------------------------------- |
| `code`       | string     | yes      | Short human-readable join code (e.g. `ABCD12`). Unique per project.    |
| `title`      | string     | yes      | Display name of the event. 1–100 chars.                                |
| `status`     | string     | yes      | One of `draft`, `active`, `ended`.                                     |
| `createdBy`  | string     | yes      | UID of the organizer who created the event.                            |
| `createdAt`  | timestamp  | yes      | Server timestamp at creation.                                          |
| `startedAt`  | timestamp  | no       | Server timestamp when `status` first flipped to `active`.              |
| `endedAt`    | timestamp  | no       | Server timestamp when `status` flipped to `ended`.                     |
| `settings`   | map        | yes      | See below.                                                             |

### `events.settings`

| Field                 | Type           | Required | Default | Notes                                                      |
| --------------------- | -------------- | -------- | ------- | ---------------------------------------------------------- |
| `allowedDomains`      | array<string>  | yes      | `[]`    | Email domains permitted to join. Empty = any domain.       |
| `allowAnonymousName`  | boolean        | yes      | `false` | If true, participants can set a display name.              |
| `commentSpeed`        | number         | yes      | `5`     | Seconds for a comment to cross the screen (projection).    |
| `fontSize`            | number         | yes      | `48`    | Comment font size in px (projection).                      |
| `maxConcurrent`       | number         | yes      | `50`    | Max simultaneous comments on screen (projection).          |
| `ngWords`             | array<string>  | yes      | `[]`    | Client-side NG word list. Rules may also enforce.          |

### Lifecycle

`status` transitions: `draft → active → ended`. Transitions are one-way; no
reopening an ended event.

Only `createdBy` (or other admins in a future version) can modify the event
document.

### Indexes

- `code` should be queryable (to resolve join codes to events). A single-field
  index is sufficient; Firestore provides these automatically.

---

## `events/{eventId}/comments/{commentId}`

One document per posted comment.

| Field         | Type       | Required | Notes                                                                     |
| ------------- | ---------- | -------- | ------------------------------------------------------------------------- |
| `text`        | string     | yes      | The comment body. 1–200 chars.                                            |
| `author`      | string     | yes      | Display name. Falls back to the Google profile name.                      |
| `authorUid`   | string     | yes      | Firebase Auth UID.                                                        |
| `authorEmail` | string     | yes      | Email of the author (used for domain-based audits).                       |
| `color`       | string     | yes      | CSS color (hex or named). Chosen client-side.                             |
| `createdAt`   | timestamp  | yes      | Server timestamp.                                                         |
| `hidden`      | boolean    | no       | If `true`, projection ignores this comment. Organizers toggle this.       |

### Behavior

- Comments are **mutable only on `hidden`**: participants cannot edit their
  text after posting. Only organizers can flip `hidden`.
- Comments are never deleted in MVP. Hiding replaces deletion.

### Indexes

The projection app's primary query is:

```
collection: events/{eventId}/comments
where:      hidden != true
order by:   createdAt asc
```

This requires a composite index on `(hidden, createdAt)`. Declared in
`firestore.indexes.json`.

---

## `events/{eventId}/reactions/{reactionId}`

One document per reaction (heart / clap / fire).

| Field        | Type       | Required | Notes                                 |
| ------------ | ---------- | -------- | ------------------------------------- |
| `type`       | string     | yes      | One of `heart`, `clap`, `fire`.       |
| `authorUid`  | string     | yes      | Firebase Auth UID.                    |
| `createdAt`  | timestamp  | yes      | Server timestamp.                     |

### Behavior

- **Immutable.** Reactions cannot be updated or deleted after creation.
- No hiding or moderation of reactions. They are fire-and-forget signals.
- Adding new `type` values requires updating rules in this repo **and** the
  Swift enum in `tsudoi-macos`.

### Indexes

```
collection: events/{eventId}/reactions
order by:   createdAt asc
```

Single-field index, automatic.

---

## Authorization summary

Detailed rules live in `firestore.rules`. At a high level:

- **Read access to `events/{id}`**: any authenticated user whose email domain
  matches `settings.allowedDomains` (or any user if `allowedDomains` is empty).
- **Write access to `events/{id}`**: only the document's `createdBy`.
- **Create `comments`**: authenticated users meeting the domain check, while
  `status == "active"`. `authorUid` must equal `request.auth.uid`. `text`
  length must be within 1–200 chars.
- **Update `comments`**: only the event's `createdBy`, and only the `hidden`
  field.
- **Delete `comments`**: never (in MVP).
- **Create `reactions`**: same as comments. Immutable after creation.

---

## Non-goals

These are **not** part of the schema and should not be added without a design
discussion:

- Polls, quizzes, Q&A upvotes.
- Threaded replies to comments.
- Long-term archival or export of past events.
- User profile documents. We use Firebase Auth as the source of user identity.
