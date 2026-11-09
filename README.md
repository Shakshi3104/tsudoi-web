# Tsudoi (Web)

Open-source, self-hostable alternative to CommentScreen — a real-time
comment overlay for slides. Built for internal all-hands meetings where
the free tier of commercial alternatives caps participant counts.

This repository is the web side: participant comment UI (`/join/:code`)
and organizer admin UI (`/admin`). The transparent projection window is
in a separate [`tsudoi-macos`](../tsudoi-macos) repo.

- React + Vite + TypeScript
- Firebase (Firestore, Auth, Hosting) — no custom backend
- Google SSO with optional Workspace domain gating

License: MIT.

## Architecture at a glance

- Participants sign in with Google, post comments straight into Firestore.
- Organizers create events and flip `status` (`draft` → `active` → `ended`).
- The macOS app subscribes to the event's `comments` subcollection and
  animates incoming messages on a transparent always-on-top window.
- Authorization is entirely in `firestore.rules` — domain gating per event
  plus status / owner checks.

See `docs/firestore-schema.md` for the data model and `CLAUDE.md` for the
full design notes.

## Setup

1. **Firebase project**

   - Create a Firebase project (or pick an existing one).
   - Enable **Firestore** in `asia-northeast1` (or your preferred region —
     note it cannot be changed after creation).
   - Enable **Authentication → Google** provider.
   - Register a **Web app** and copy the config values.

2. **Environment files**

   ```sh
   cp .env.example .env.local
   cp .firebaserc.example .firebaserc
   ```

   Fill in:
   - `.env.local`: `VITE_FIREBASE_*` values from the Firebase console web
     config, optionally `VITE_ALLOWED_DOMAIN` to restrict Google sign-in to
     one Workspace domain, and `VITE_ADMIN_PASSWORD` to soft-gate `/admin`.
   - `.firebaserc`: your Firebase project ID.

3. **Install and run**

   ```sh
   npm install
   npm run dev
   ```

4. **Deploy rules, indexes, and hosting**

   ```sh
   firebase login
   firebase deploy --only firestore   # rules + indexes
   npm run build && firebase deploy --only hosting
   ```

5. **Optional: share event management within a domain**

   By default each organizer sees only the events they created in `/admin`.
   To let everyone in a Workspace domain see and manage each other's events,
   create the document `config/adminSharing` in the Firebase console with a
   `domains` array field, e.g. `["example.com"]`. Members of a listed domain
   get the same permissions as the creator, including delete.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run lint` | ESLint across `.ts` / `.tsx` |
| `firebase emulators:start` | Local Firestore + Auth emulators |

## Contributing

- The data model lives in `docs/firestore-schema.md`. Keep
  `src/types/models.ts` in sync; update the macOS models in parallel.
- Do not weaken `firestore.rules` to work around a bug — fix the rule.
- See `CLAUDE.md` for commit conventions and the full design rationale.

## Related

- [`tsudoi-macos`](../tsudoi-macos) — Swift/SwiftUI projection app
- [Firebase Console](https://console.firebase.google.com/) — project admin
