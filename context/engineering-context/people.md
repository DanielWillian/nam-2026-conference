---
area: people
summary: The People deck at /people, where a buyer meets sellers (and the reverse) who share a track, with pass, like and Matches.
read_when: touching /people, the deck, passing or liking someone, matches, people_decisions, or the seeded likes
files:
  - server/lib/people.js
  - src/pages/PeoplePage.jsx
tests:
  - tests/api/people.test.js
  - tests/api/people-seed.test.js
  - tests/people.spec.js
related: [data-model, seed, ui]
---

# People

## How it works

**`server/lib/people.js`** is plain SQL over `db`, and the routes in `server/routes/users.js` stay thin.

- `deckFor(userId)` is attendees of the opposite role who share at least one `user_tracks` row with the
  attendee, are not the attendee, and have no `people_decisions` row from them, ordered by id. Empty
  unless `isReady(user)`: a role and at least one saved track.
- `matchesFor(userId)` is mutual likes. It never looks at either side's current role or tracks, which is
  what keeps a match through a role change.
- `decide(userId, targetId, choice)` is `INSERT OR IGNORE`, so the first choice stands and a repeat answers
  with it. Returns `{ choice, matched }`; `matched` is true when the target already liked back.
- Cards are `toUser` rows plus `trackSlugs`.

**Routes.** `GET /api/users/:id/people` returns `{ ready, deck, matches }`. `PUT /api/users/:id/people/:targetId`
`{ choice: 'like' | 'pass' }` is 404 for an unknown attendee or target, 400 for another choice or for yourself.

**Page.** `PeoplePage` fetches `api.getPeople(currentUserId)` with `useFetch`, so switching attendee refetches.
It shows the first card; a click calls `api.decidePerson`, drops the card and, when `matched`, adds the
person to Matches without a refetch. Test ids: `people-prompt` (link to `/profile`), `people-card`,
`people-pass`, `people-like`, `people-matches`, `match-item`.

## Gotchas

- Likes and roles are permanent, so a spec that writes them takes its own lane (`people.deck`) and reads the
  deck from the API rather than assuming where it starts.
- The seed plants three likes for each of users 1 to 6 (`LIKES` in `server/seed.js`, from crowd members of
  both roles) so a seeded attendee who picks a role and a track can match at once.
