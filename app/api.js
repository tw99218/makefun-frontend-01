// Read-only client for make.fun's public API (GET only, any origin).
// Answers are kept in a small in-memory cache and revalidated with ETags:
// a fresh answer costs no request, a stale one costs a single 304, and
// simultaneous calls for one URL share a single fetch.

const BASE = 'https://make.fun/api';
const FRESH_FOR_MS = 60_000;

const store = new Map(); // path -> { body, etag, at }
const pending = new Map(); // path -> promise
const counts = { fetched: 0, hits: 0, revalidated: 0 };

export function netStats() {
  return { ...counts };
}

/** A cached body for a path, if one is stored (used as a stale fallback). */
export function cachedBody(path) {
  const entry = store.get(path);
  return entry ? entry.body : null;
}

async function fetchOnce(path, etag) {
  counts.fetched += 1;
  const headers = etag ? { 'If-None-Match': etag } : {};
  const res = await fetch(BASE + path, { headers });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
  return { notModified: false, etag: res.headers.get('ETag'), body: await res.json() };
}

/**
 * GET one API path as JSON. A fresh cached answer (under a minute) costs
 * no request; an older one revalidates with If-None-Match and a 304 keeps
 * the stored body. A failed fetch throws; callers may fall back to
 * cachedBody() and say the data is stale.
 */
export function getJSON(path) {
  const hit = store.get(path);
  if (hit && Date.now() - hit.at < FRESH_FOR_MS) {
    counts.hits += 1;
    return Promise.resolve(hit.body);
  }
  if (pending.has(path)) return pending.get(path);
  const job = fetchOnce(path, hit && hit.etag)
    .then((out) => {
      if (out.notModified && hit) {
        counts.revalidated += 1;
        hit.at = Date.now();
        return hit.body;
      }
      store.set(path, { body: out.body, etag: out.etag, at: Date.now() });
      return out.body;
    })
    .finally(() => pending.delete(path));
  pending.set(path, job);
  return job;
}

/** The open bounties: { items: [...], next_cursor }. */
export const listBounties = () => getJSON('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const oneBounty = (slug) => getJSON(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: { competition, columns, entries: [...] }. */
export const bountyLeaderboard = (slug) => getJSON(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const oneProfile = (handle) => getJSON(`/profiles/${encodeURIComponent(handle)}`);
