import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** The likes the seed plants, so a fresh attendee can match straight away. */

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

describe('the seeded likes', () => {
  test('each seeded attendee, in either role, has a card who already likes them', async () => {
    for (let id = 1; id <= 6; id++) {
      for (const role of ['buyer', 'seller']) {
        await setUp(id, role, slugs);
        const { deck } = await people(id);
        const results = [];
        for (const card of deck) results.push((await decide(id, card.id, 'like')).body.matched);
        assert.ok(results.some(Boolean), `attendee ${id} as a ${role} matches someone`);
      }
    }
  });
});
