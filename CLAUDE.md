# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
this repository.

## Project: Tsudoi (Web)

Tsudoi is an open-source, self-hostable alternative to CommentScreen — a tool
that overlays live audience comments onto presentation slides, in the style of
Niconico Douga. Built for internal company all-hands meetings where the free
tier of commercial alternatives caps participant counts.

This repository hosts the **web application**: the participant comment UI and
the organizer admin UI. Together with `tsudoi-macos` (the projection app for
macOS), it forms the complete system.

- Related repository: `tsudoi-macos` — Swift/SwiftUI app that displays comments
  as a transparent overlay on top of presentation software (PowerPoint,
  Keynote, etc).
- Design documents: `tsudoi-dev` — Architecture docs and ADRs.
- License: MIT
- Primary documentation language: English (README has a Japanese translation)

## Architecture

### System overview

Three user-facing surfaces, one backend:

1. **Participant web (this repo, `/join/:eventCode`)** — Smartphone-oriented
   comment posting UI. Google SSO required.
2. **Organizer web (this repo, `/admin`)** — Event creation and moderation.
3. **Projection app (`tsudoi-macos`)** — Transparent, always-on-top window
   that listens to Firestore and animates comments flowing right to left.
4. **Firebase** — Firestore for storage, Firebase Auth for Google SSO,
   Firebase Hosting for serving this web app.

There is no custom backend server. The web app talks to Firestore directly,
and Firestore security rules (`firestore.rules`) enforce authorization.

### Tech stack

- React + Vite + TypeScript
- Firebase JS SDK (Firestore, Auth, Hosting)
- Routing: React Router
- Styling: TBD (likely Tailwind; confirm before adding)

### Key directories

```
tsudoi-web/
├── firebase.json              # Firebase project config
├── firestore.rules            # Security rules (authoritative)
├── firestore.indexes.json     # Composite indexes
├── .firebaserc.example        # Template; real .firebaserc is gitignored
├── docs/
│   └── firestore-schema.md    # Single source of truth for the data model
├── src/
│   ├── pages/
│   │   ├── Home.tsx           # Landing / event code entry
│   │   ├── Join.tsx           # Participant comment posting
│   │   └── Admin.tsx          # Organizer event management
│   ├── lib/
│   │   └── firebase.ts        # Firebase initialization
│   └── types/
│       └── models.ts          # TypeScript types mirroring Firestore schema
├── .env.example               # VITE_FIREBASE_* keys
└── .env.local                 # Real values (gitignored)
```

## Firestore schema (summary)

Full schema lives in `docs/firestore-schema.md`. Short version:

```
events/{eventId}
├── comments/{commentId}
└── reactions/{reactionId}
```

- `events`: one document per session. Fields: `code`, `title`, `status`
  (`draft` / `active` / `ended`), `createdBy`, `settings`.
- `events.settings`: `allowedDomains`, `allowAnonymousName`, `commentSpeed`,
  `fontSize`, `maxConcurrent`, `ngWords`.
- `comments`: `text` (<= 200 chars), `author`, `authorUid`, `authorEmail`,
  `color`, `createdAt`, `hidden`.
- `reactions`: `type` (`heart` / `clap` / `fire`), `authorUid`, `createdAt`.
  Immutable after creation.

**Do not introduce new collections or fields without updating
`docs/firestore-schema.md` and coordinating with `tsudoi-macos`.**

## Key design decisions

These were settled after deliberation and should not be revisited without good
reason:

- **Multi-repo:** split into three repos (`tsudoi-web` for web, `tsudoi-macos`
  for the projection app, `tsudoi-dev` for design docs). Web owns the Firebase
  project config.
- **Auth:** Google OAuth SSO only. No anonymous or email/password. Domain
  restriction enforced per-event via `settings.allowedDomains`.
- **Reactions as separate subcollection:** reactions are fire-and-forget,
  immutable, and animated differently from comments — keeping them in their
  own collection simplifies both the schema and the projection rendering.
- **No custom backend:** clients write directly to Firestore; security rules
  are the only authorization layer. This keeps the Spark (free) tier
  sufficient for MVP.
- **Region:** `asia-northeast1` (Tokyo). Cannot be changed post-creation.
- **NG word filtering:** client-side for UX, with rules as a secondary check.
  No Cloud Functions in MVP.
- **Polls / quizzes:** out of scope for MVP. Do not add schema or UI for them.

## Development workflow

### Commit conventions

Conventional Commits with a scope:
- `feat(web): add comment posting form`
- `feat(admin): event creation UI`
- `fix(firestore): tighten comment write rule`
- `docs: update schema`
- `chore: update dependencies`

### Branching

- `main`: always deployable.
- Feature work on short-lived branches, merged via PR.

### Before merging a PR that touches the schema

1. Update `docs/firestore-schema.md`.
2. Update `src/types/models.ts`.
3. Open a companion issue or PR in `tsudoi-macos` to keep Swift models in sync.
4. Bump the schema version in `docs/firestore-schema.md`.
5. Note breaking changes in `CHANGELOG.md`.

### Environment setup

- Copy `.firebaserc.example` to `.firebaserc` and fill in your Firebase
  project ID.
- Copy `.env.example` to `.env.local` and fill in `VITE_FIREBASE_*`
  values from the Firebase console.
- Run `npm install`.
- `npm run dev` for local development.
- `firebase emulators:start` to run Firestore/Auth locally.

## What Claude should do / avoid

### Do

- Read `docs/firestore-schema.md` before writing any Firestore code. The file
  is authoritative — if it disagrees with your memory, trust the file.
- Keep all user-facing strings in English by default, with Japanese as a
  secondary layer only when the UI is intended for Japanese end-users.
- Surface schema changes prominently in PR descriptions. Schema drift between
  this repo and `tsudoi-macos` is the single biggest risk.
- Follow the commit conventions above.

### Avoid

- **Do not** commit `.firebaserc`, `.env.local`, or any file containing real
  Firebase project IDs or API keys. The provided `.gitignore` covers these;
  double-check before committing.
- **Do not** add anonymous auth, email/password auth, or bypasses to the
  Google SSO requirement without an explicit design discussion.
- **Do not** introduce a custom Node.js/Express backend. The architecture is
  deliberately serverless.
- **Do not** add poll/quiz/survey functionality; these were explicitly deferred
  post-MVP.
- **Do not** use Cloud Functions in MVP. If you think one is needed, raise it
  as a discussion first.
- **Do not** weaken `firestore.rules` to make development easier. If a rule
  blocks legitimate behavior, fix the rule correctly.
- **Do not** reproduce large swathes of the original CommentScreen's UI or
  copy. Tsudoi is an independent reimplementation with its own identity.

## Useful context

- The tool is for internal events (50–200 participants, monthly cadence, ~1h).
  Do not over-engineer for scale beyond that. At the same time, Firestore's
  free tier comfortably handles this load, so performance concerns are minor.
- The projection method of choice for MVP is a **native transparent window**
  on macOS (handled by `tsudoi-macos`), not OBS chroma-keying or browser
  fullscreen. This affects how the web app handles display — the `/screen`
  route that used to exist in early designs is no longer needed here.
- When in doubt about scope, prefer smaller and later over larger and sooner.
  The MVP target is a working end-to-end flow for one real all-hands meeting.
