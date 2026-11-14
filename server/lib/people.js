import { db } from '../db.js';
import { toUser } from './query.js';

/**
 * The People deck: who an attendee may still meet, who they matched with, and
 * the pass or like that moves someone between the two.
 */

const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const slugsOf = db.prepare(`
  SELECT t.slug FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
  WHERE ut.user_id = ? ORDER BY t.id`);
const trackCount = db.prepare('SELECT COUNT(*) n FROM user_tracks WHERE user_id = ?');

const deckRows = db.prepare(`
  SELECT u.* FROM users u
  WHERE u.id != @id AND u.role = @opposite
    AND EXISTS (SELECT 1 FROM user_tracks a JOIN user_tracks b ON b.track_id = a.track_id
                WHERE a.user_id = @id AND b.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = @id AND d.target_id = u.id)
  ORDER BY u.id`);

// Mutual likes only. Neither side's current role or tracks is looked at, so a
// match survives either of them changing.
const matchRows = db.prepare(`
  SELECT u.* FROM users u
  WHERE EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = @id AND d.target_id = u.id AND d.choice = 'like')
    AND EXISTS (SELECT 1 FROM people_decisions d WHERE d.user_id = u.id AND d.target_id = @id AND d.choice = 'like')
  ORDER BY u.id`);

const insertDecision = db.prepare('INSERT OR IGNORE INTO people_decisions (user_id, target_id, choice) VALUES (?, ?, ?)');
const storedChoice = db.prepare('SELECT choice FROM people_decisions WHERE user_id = ? AND target_id = ?');
const likedBy = db.prepare(`SELECT 1 FROM people_decisions WHERE user_id = ? AND target_id = ? AND choice = 'like'`);

const card = (row) => toUser(row, { trackSlugs: slugsOf.all(row.id).map((t) => t.slug) });

/** The attendee needs a role and at least one saved track before they have a deck. */
export function isReady(user) {
  return !!user.role && trackCount.get(user.id).n > 0;
}

export function deckFor(userId) {
  const me = getUser.get(userId);
  if (!isReady(me)) return [];
  return deckRows.all({ id: userId, opposite: me.role === 'buyer' ? 'seller' : 'buyer' }).map(card);
}

export function matchesFor(userId) {
  return matchRows.all({ id: userId }).map(card);
}

/** Stores the first choice and keeps it; `matched` is true when the other side already liked back. */
export function decide(userId, targetId, choice) {
  insertDecision.run(userId, targetId, choice);
  const stored = storedChoice.get(userId, targetId).choice;
  return { choice: stored, matched: stored === 'like' && !!likedBy.get(targetId, userId) };
}
