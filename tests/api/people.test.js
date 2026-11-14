import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * The People deck: opposite role, a shared track, never yourself, never anyone
 * already decided. Pass and like are stored, a returned like is a match, and a
 * match outlives a change of role.
 */

let api;
let close;
let slugs;

before(async () => {
  ({ api, close } = await startApi());
  slugs = (await api.json('/bootstrap')).tracks.map((t) => t.slug);
});
after(() => close());

const setUp = async (id, role, trackSlugs) => {
  await api.put(`/users/${id}/role`, { role });
  await api.put(`/users/${id}/tracks`, { trackSlugs });
};
const people = (id) => api.json(`/users/${id}/people`);
const decide = (id, target, choice) => api.put(`/users/${id}/people/${target}`, { choice });

describe('GET /users/:id/people', () => {
  test('the deck is the opposite role sharing a track, never the attendee', async () => {
    await setUp(1, 'seller', [slugs[0]]);
    const { ready, deck } = await people(1);
    assert.equal(ready, true);
    assert.ok(deck.length > 0, 'a seller on one track has someone to meet');

    const everyone = await Promise.all(
      Array.from({ length: 26 }, (_, i) => api.json(`/users/${i + 1}`)));
    const expected = everyone
      .filter((u) => u.id !== 1 && u.role === 'buyer' && u.trackSlugs.includes(slugs[0]))
      .map((u) => u.id);
    assert.deepEqual(deck.map((c) => c.id), expected, 'exactly the buyers who share the track, by id');
    for (const card of deck) {
      assert.equal(card.role, 'buyer');
      assert.ok(card.trackSlugs.includes(slugs[0]));
      assert.notEqual(card.id, 1);
    }
    assert.ok(everyone.some((u) => u.role === 'buyer' && u.id > 6 && !u.trackSlugs.includes(slugs[0])),
      'the crowd has a buyer who shares nothing, and the deck leaves them out');
  });

  test('no role, or a role with no tracks, is not ready and has no deck', async () => {
    assert.deepEqual(await people(2), { ready: false, deck: [], matches: [] });
    await api.put('/users/2/role', { role: 'buyer' });
    const noTracks = await people(2);
    assert.equal(noTracks.ready, false);
    assert.deepEqual(noTracks.deck, []);
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.get('/users/9999/people');
    assert.equal(res.status, 404);
  });
});

describe('PUT /users/:id/people/:targetId', () => {
  test('a pass or a like takes the card out for good, and the first choice stands', async () => {
    await setUp(3, 'buyer', slugs);
    const [a, b] = (await people(3)).deck;
    assert.deepEqual((await decide(3, a.id, 'pass')).body, { choice: 'pass', matched: false });
    assert.ok(!(await people(3)).deck.some((c) => c.id === a.id));

    await decide(3, b.id, 'like');
    assert.ok(!(await people(3)).deck.some((c) => c.id === b.id));

    const again = await decide(3, a.id, 'like');
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { choice: 'pass', matched: false }, 'the first decision is kept');
  });

  test('refuses a bad choice, yourself and strangers', async () => {
    assert.equal((await decide(3, 7, 'maybe')).status, 400);
    assert.equal((await decide(3, 3, 'like')).status, 400);
    assert.equal((await decide(3, 9999, 'like')).status, 404);
    assert.equal((await decide(9999, 7, 'like')).status, 404);
  });

  test('a returned like is a match at once, an unreturned one is not', async () => {
    // seed: crowd members 7 (buyer), 8 (seller) and 9 (buyer) like attendee 1
    await setUp(1, 'buyer', slugs);
    const before = (await people(1)).matches.length;
    const { deck } = await people(1);
    const stranger = deck.find((c) => c.id !== 8);
    const miss = await decide(1, stranger.id, 'like');
    assert.equal(miss.body.matched, false);
    assert.equal((await people(1)).matches.length, before);

    const hit = await decide(1, 8, 'like');
    assert.equal(hit.body.matched, true);
    const { matches } = await people(1);
    assert.deepEqual(matches.map((m) => m.id), [8]);
  });

  test('two attendees keep their own decks and matches', async () => {
    await setUp(5, 'seller', slugs);
    await setUp(6, 'seller', slugs);
    const first = (await people(5)).deck[0];
    await decide(5, first.id, 'pass');
    assert.ok((await people(6)).deck.some((c) => c.id === first.id));
    assert.deepEqual((await people(6)).matches, []);
  });

  test('changing role keeps the matches already made', async () => {
    await setUp(4, 'seller', slugs);
    // seed: crowd members 16 (seller), 17 (buyer) and 18 (seller) like attendee 4
    assert.equal((await decide(4, 17, 'like')).body.matched, true);
    await api.put('/users/4/role', { role: 'buyer' });
    const after = await people(4);
    assert.equal(after.ready, true);
    assert.deepEqual(after.matches.map((m) => m.id), [17]);
    assert.ok(after.deck.every((c) => c.role === 'seller'));
  });
});
