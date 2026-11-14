# Let attendees filter the schedule by more than one track

## What this changes
On `/schedule` the track pills become toggles. Any combination can be on, the list shows sessions from every selected track, and the URL reads `?track=a,b`. **All** clears the selection and is the only lit pill when none is selected; deselecting the last track returns to All. A single `?track=a` link shows what it did before. With one or several tracks the grid stays disabled and the list shows, as today.

## Where
- `server/routes/sessions.js` (line 38) — split `trackSlug` on commas into `t.slug IN (?, ?)`, dropping empty parts; one value is the same query as today. `speakers.js` is untouched.
- `src/pages/SchedulePage.jsx` — `filters.track` stays the raw URL string (so `trackSlug`, the fetch deps, `activeKeys` and `BLOCKERS` keep working); derive `selectedTracks = filters.track === ALL ? [] : filters.track.split(',')`. The track `onClick` (line ~174) toggles the slug in that list and calls `set('track', list.join(','))`, which already deletes the key when empty; `active` is `selectedTracks.includes(t.slug)`; add `aria-pressed={active}`; the **All** pill is lit when `selectedTracks` is empty.
- Tests: API check in `tests/api/endpoints.test.js` (new case, existing ones untouched); browser check in `tests/schedule.spec.js` using `visit`, `waitForResults`, `API` and `conferenceDays()` from `tests/helpers.js`. It only reads, so no data lane is needed.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Two tracks list the sessions of both, URL `?track=a,b` | `GET /sessions?day=d&trackSlug=a,b` returns the union of the single-track results; the spec clicks two pills, asserts the URL and `result-count` equals the sum of the API counts | API + spec |
| Each pill exposes `aria-pressed` | spec asserts `aria-pressed` true on selected pills, false on others | spec |
| Deselecting one of two leaves the other | spec clicks one off, asserts URL `?track=<other>` and `result-count` equals that track's API count | spec |
| All, or deselecting the last, removes `track` and lists everything | spec asserts `not.toHaveURL(/track=/)` and `result-count` equals the day's unfiltered API count, and **All** has `aria-pressed`-free lit state via URL | spec |
| `?track=<a>` unchanged, `endpoints.test.js` passes | existing `endpoints.test.js` `trackSlug` cases still pass; a link with one slug matches the single-track API count | API + spec |
| List shown, grid disabled with one or several | spec asserts `view-grid` is disabled with two tracks selected | spec |
| Add one track and remove one, `result-count` vs API each time | the spec above, in sequence: add a, add b, remove a, remove b | spec |

## Decisions
- A track slug that does not exist inside a comma list (`?track=a,nope`) just matches nothing for that part, as a bad single slug does today — OK?

## Out of scope
Multi select for topic, level and format, and the track filter on `/speakers`.
