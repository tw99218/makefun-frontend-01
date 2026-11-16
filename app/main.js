// Router and page rendering for the make.fun frontend.
//
//   #/                              the board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     its leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a page loads and true once its data
// is on screen, so a screenshot script knows when to capture. Time-left
// labels tick every 30 seconds without rebuilding the page.

import { cachedBody, listBounties, oneBounty, bountyLeaderboard, oneProfile, netStats } from './api.js';
import { timeLeft } from './format.js';
import { boardListHTML, boardPageHTML, bountyPageHTML, filterBoard, filterEntries, leaderboardPageHTML, leaderboardTableHTML, profilePageHTML } from './views.js';

const app = document.getElementById('app');
const net = document.getElementById('net-stats');

const boardState = { q: '', sort: 'deadline', filter: 'all' };
const boardCache = { data: null };
const lbState = { q: '', page: 1 };
const lbCache = { data: null };

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  if (!hash) return { name: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return { name: 'leaderboard', slug: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'bounty' && parts[1]) return { name: 'bounty', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'u' && parts[1]) return { name: 'profile', handle: decodeURIComponent(parts[1]) };
  return { name: 'notfound' };
}

function showNet() {
  const s = netStats();
  const req = `${s.fetched} API request${s.fetched === 1 ? '' : 's'}`;
  net.textContent = `${req} · ${s.hits} served from cache · ${s.revalidated} revalidated`;
}

function errorPage(title, detail, showRetry) {
  const retry = showRetry ? '<button class="btn" id="retry">Try again</button> ' : '';
  return `<div class="error-box" role="alert">
    <h1>${title}</h1>
    <p>${detail}</p>
    <p>${retry}<a class="btn btn-secondary" href="#/">Back to the board</a></p>
  </div>`;
}

function done(title) {
  document.title = title;
  showNet();
  window.scrollTo(0, 0);
  const h1 = app.querySelector('h1');
  if (h1 && h1.focus) h1.focus();
  window.__shotReady = true;
}

function wireRetry() {
  const btn = document.getElementById('retry');
  if (btn) btn.addEventListener('click', () => render());
}

function wireBoard() {
  const q = document.getElementById('board-q');
  const sort = document.getElementById('board-sort');
  const filter = document.getElementById('board-filter');
  const refresh = () => {
    const list = document.getElementById('board-list');
    const count = document.getElementById('board-count');
    const data = boardCache.data;
    if (!data) return;
    if (list) list.innerHTML = boardListHTML(data.items || [], boardState);
    if (count) count.textContent = `${filterBoard(data.items || [], boardState).length} of ${(data.items || []).length} bounties`;
  };
  if (q) q.addEventListener('input', () => { boardState.q = q.value; refresh(); });
  if (sort) sort.addEventListener('change', () => { boardState.sort = sort.value; refresh(); });
  if (filter) filter.addEventListener('change', () => { boardState.filter = filter.value; refresh(); });
}

function wireLeaderboard() {
  const q = document.getElementById('lb-q');
  const refresh = () => {
    const table = document.getElementById('lb-table');
    const count = document.getElementById('lb-count');
    const data = lbCache.data;
    if (!data) return;
    if (table) {
      table.innerHTML = leaderboardTableHTML(data.entries || [], lbState);
      wirePager();
    }
    if (count) count.textContent = `${filterEntries(data.entries || [], lbState).length} of ${(data.entries || []).length} entries`;
  };
  if (q) q.addEventListener('input', () => { lbState.q = q.value; lbState.page = 1; refresh(); });
  wirePager();
}

function wirePager() {
  const prev = document.getElementById('lb-prev');
  const next = document.getElementById('lb-next');
  if (prev) prev.addEventListener('click', () => { lbState.page = Math.max(1, lbState.page - 1); renderLbTable(); });
  if (next) next.addEventListener('click', () => { lbState.page += 1; renderLbTable(); });
}

function renderLbTable() {
  const table = document.getElementById('lb-table');
  if (table && lbCache.data) {
    table.innerHTML = leaderboardTableHTML(lbCache.data.entries || [], lbState);
    wirePager();
    table.scrollIntoView({ block: 'start' });
  }
}

async function render() {
  window.__shotReady = false;
  const route = parseRoute();
  try {
    if (route.name === 'board') {
      app.innerHTML = '<p class="loading">Loading live bounties…</p>';
      boardCache.data = await listBounties();
      app.innerHTML = boardPageHTML(boardCache.data, boardState);
      wireBoard();
      done('make.fun bounties');
    } else if (route.name === 'bounty') {
      app.innerHTML = '<p class="loading">Loading bounty…</p>';
      const bounty = await oneBounty(route.slug);
      app.innerHTML = bountyPageHTML(bounty);
      done(`${bounty.title} | make.fun bounties`);
    } else if (route.name === 'leaderboard') {
      app.innerHTML = '<p class="loading">Loading leaderboard…</p>';
      lbCache.data = await bountyLeaderboard(route.slug);
      lbState.page = 1;
      app.innerHTML = leaderboardPageHTML(lbCache.data, lbState);
      wireLeaderboard();
      done(`Leaderboard · ${lbCache.data.competition?.title || route.slug} | make.fun bounties`);
    } else if (route.name === 'profile') {
      app.innerHTML = '<p class="loading">Loading profile…</p>';
      const profile = await oneProfile(route.handle);
      app.innerHTML = profilePageHTML(profile);
      done(`@${profile.handle} | make.fun bounties`);
    } else {
      app.innerHTML = errorPage('Page not found', 'That address does not name a board, bounty, leaderboard or profile.', false);
      wireRetry();
      done('Not found | make.fun bounties');
    }
  } catch (err) {
    // The board can fall back to its last cached answer and say so.
    if (route.name === 'board') {
      const stale = cachedBody('/competitions?status=open&activity=times');
      if (stale) {
        boardCache.data = stale;
        app.innerHTML = '<p class="notice" role="status">Live data is unreachable right now — showing the last cached board.</p>' + boardPageHTML(boardCache.data, boardState);
        wireBoard();
        done('make.fun bounties');
        return;
      }
    }
    const what = route.name === 'profile' ? 'account' : route.name === 'leaderboard' ? 'leaderboard' : route.name === 'bounty' ? 'bounty' : 'board';
    app.innerHTML = errorPage(
      `Could not load this ${what}`,
      'make.fun did not answer. Check your connection and try again.',
      true,
    );
    wireRetry();
    done('Error | make.fun bounties');
  }
}

// Time-left labels tick in place, without rebuilding the page.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  });
}, 30000);

document.getElementById('profile-search').addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = document.getElementById('handle-input').value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', render);
render();
