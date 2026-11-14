import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * What the seed promises the app, checked on the seeded database itself.
 *
 * An attendee chooses interests from the topic tags, so a seeded interest
 * that is not one can never be shown — and a save from the picker drops it.
 * Kenji's `Edge`, a tech tag, did exactly that on #219.
 */

let api;
let close;

before(async () => { ({ api, close } = await startApi()); });
after(() => close());

describe('Seeded attendees', () => {
  test('every interest is a topic tag', async () => {
    const { users, tags } = await api.json('/bootstrap');
    const topics = new Set(tags.filter((t) => t.kind === 'topic').map((t) => t.name));
    assert.ok(topics.size > 0 && users.some((u) => u.interests.length), 'the seed has topics and interests to check');
    const strays = users.flatMap((u) => u.interests.filter((i) => !topics.has(i)).map((i) => `${u.name}: ${i}`));
    assert.deepEqual(strays, []);
  });

  test('the six attendees start with no role', async () => {
    const { users } = await api.json('/bootstrap');
    assert.equal(users.length, 26, 'six attendees and a crowd of twenty');
    for (const u of users.slice(0, 6)) assert.equal((await api.json(`/users/${u.id}`)).role, null, u.name);
  });

  test('the six attendees start with no tracks chosen', async () => {
    const { users } = await api.json('/bootstrap');
    assert.deepEqual(users.slice(0, 6).map((u) => u.id), [1, 2, 3, 4, 5, 6]);
    for (const u of users.slice(0, 6)) assert.deepEqual((await api.json(`/users/${u.id}`)).trackSlugs, [], u.name);
  });
});

describe('The mock crowd', () => {
  const crowdIds = Array.from({ length: 20 }, (_, i) => i + 7);

  test('each has a role and two to four tracks, and both roles are used', async () => {
    const { users } = await api.json('/bootstrap');
    assert.deepEqual(users.slice(6).map((u) => u.id), crowdIds);
    const roles = new Set();
    for (const id of crowdIds) {
      const u = await api.json(`/users/${id}`);
      assert.ok(['buyer', 'seller'].includes(u.role), `${u.name} has a role`);
      assert.ok(u.trackSlugs.length >= 2 && u.trackSlugs.length <= 4, `${u.name} has 2 to 4 tracks`);
      roles.add(u.role);
    }
    assert.deepEqual([...roles].sort(), ['buyer', 'seller']);
  });

  test('none is a host, so the switcher lists only the six', async () => {
    const { users } = await api.json('/bootstrap');
    const hosts = users.filter((u) => u.company === 'Equal Experts').map((u) => u.name);
    assert.deepEqual(hosts, ['Jonas Claesson', 'Andy Vays', 'Abraham Marín Pérez']);
  });

  test('none holds a seat or a waitlist place', async () => {
    for (const id of crowdIds) {
      const { days } = await api.json(`/users/${id}/schedule`);
      const held = days.flatMap((d) => [...(d.booked ?? []), ...(d.waitlisted ?? [])]);
      assert.equal(held.length, 0, `attendee ${id}`);
    }
  });
});
