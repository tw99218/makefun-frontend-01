// The four surfaces, each a function from API data to HTML.
// Lists re-render in place (boardListHTML, leaderboardTableHTML) so typing
// in a filter box never loses focus or rebuilds the whole page.

import { bytes, count, dateStr, esc, isOpen, rate, shortWallet, timeLeft, usd } from './format.js';

/** The live pot: entry fees paid in, on top of the base reward. */
const livePot = (b) => usd(b.potUsd ?? b.rewardAmount);

function bountyHref(b) {
  return `#/bounty/${encodeURIComponent(b.slug)}`;
}

function profileHref(handle) {
  return `#/u/${encodeURIComponent(handle)}`;
}

/** An API image path (or absolute URL) as a full URL for an <img>. */
function imageUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://make.fun${path}`;
}

/** A status pill computed from the deadline, never the status alone. */
function statusPill(b) {
  if (!isOpen(b)) return '<span class="pill pill-ended">Ended</span>';
  const ms = new Date(b.deadline).getTime() - Date.now();
  if (ms < 86400000) return '<span class="pill pill-soon">Closing soon</span>';
  return '<span class="pill pill-open">Open</span>';
}

function ordinal(place) {
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  return `${place}th`;
}

// ------------------------------------------------------------------ board

export function filterBoard(items, ui) {
  const query = ui.q.trim().toLowerCase();
  let rows = items;
  if (ui.filter === 'open') rows = rows.filter((b) => isOpen(b));
  if (ui.filter === 'closing') {
    rows = rows.filter((b) => isOpen(b) && new Date(b.deadline).getTime() - Date.now() < 86400000);
  }
  if (ui.filter === 'ended') rows = rows.filter((b) => !isOpen(b));
  if (query) {
    rows = rows.filter((b) => `${b.title} ${b.slug} ${b.category || ''}`.toLowerCase().includes(query));
  }
  const sorted = [...rows];
  if (ui.sort === 'reward') {
    sorted.sort((a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount));
  } else if (ui.sort === 'entries') {
    sorted.sort((a, b) => Number(b.submissionCount || 0) - Number(a.submissionCount || 0));
  } else {
    // Live bounties first: a past deadline sorts after every open one,
    // then soonest deadline first inside each group.
    const now = Date.now();
    const liveRank = (b) => (new Date(b.deadline).getTime() > now ? 0 : 1);
    sorted.sort((a, b) => liveRank(a) - liveRank(b) || new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  }
  return sorted;
}

export function boardListHTML(items, ui) {
  const rows = filterBoard(items, ui);
  if (!rows.length) return '<p class="empty">No bounties match. Clear the search or try another filter.</p>';
  return `<ul class="board-list">${rows
    .map(
      (b) => `<li class="bounty-card">
        <a class="card-title" href="${bountyHref(b)}">${esc(b.title)}</a>
        <div class="card-meta">
          <span class="pot">${livePot(b)}</span>
          <span class="fee">${b.entryFeeUsd ? `${usd(b.entryFeeUsd)} entry fee` : 'Free entry'}</span>
          <span class="time-left" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
          <span>${count(b.submissionCount)} ${Number(b.submissionCount) === 1 ? 'entry' : 'entries'}</span>
          <span class="category">${esc(b.category || '')}</span>
          ${statusPill(b)}
        </div>
      </li>`,
    )
    .join('')}</ul>`;
}

export function boardPageHTML(data, ui) {
  const items = data.items || [];
  const shown = filterBoard(items, ui).length;
  return `
    <h1>Open bounties</h1>
    <p class="lede">Live bounties on make.fun. Each row shows the live pot, the entry fee, the time left and how many entries it has.</p>
    <div class="controls">
      <label class="sr-only" for="board-q">Search bounties</label>
      <input type="search" id="board-q" placeholder="Search title, slug or category…" value="${esc(ui.q)}" autocomplete="off">
      <label class="sr-only" for="board-sort">Sort by</label>
      <select id="board-sort">
        <option value="deadline"${ui.sort === 'deadline' ? ' selected' : ''}>Closing soonest</option>
        <option value="reward"${ui.sort === 'reward' ? ' selected' : ''}>Largest pot</option>
        <option value="entries"${ui.sort === 'entries' ? ' selected' : ''}>Most entries</option>
      </select>
      <label class="sr-only" for="board-filter">Show</label>
      <select id="board-filter">
        <option value="all"${ui.filter === 'all' ? ' selected' : ''}>All</option>
        <option value="open"${ui.filter === 'open' ? ' selected' : ''}>Open now</option>
        <option value="closing"${ui.filter === 'closing' ? ' selected' : ''}>Closing in 24h</option>
        <option value="ended"${ui.filter === 'ended' ? ' selected' : ''}>Ended</option>
      </select>
      <span class="count" id="board-count">${shown} of ${items.length} bounties</span>
    </div>
    <div id="board-list">${boardListHTML(items, ui)}</div>`;
}

// ----------------------------------------------------------------- bounty

/** A tiny safe Markdown renderer for bounty descriptions: headings, lists, bold, code and make.fun links only. */
export function mdText(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let listItems = [];
  const flush = () => {
    if (listItems.length) out.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };
  const inline = (s) => {
    let t = esc(s);
    t = t.replace(/\[([^\]]+)\]\((https:\/\/make\.fun\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t;
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/);
    const item = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flush();
      out.push(`<h2>${inline(heading[1])}</h2>`);
    } else if (item) {
      listItems.push(`<li>${inline(item[1])}</li>`);
    } else if (line.trim() === '') {
      flush();
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}

function rewardsTableHTML(b) {
  const live = b.rewardsNow;
  if (Array.isArray(live) && live.length) {
    const rows = live
      .map(
        (r) => `<tr>
          <td>${ordinal(r.place)}</td>
          <td>${usd(r.baseUsd)}</td>
          <td>${usd(r.feeShareUsd)}</td>
          <td class="total">${usd(r.amountUsd)}</td>
        </tr>`,
      )
      .join('');
    return `<div class="scroll-x"><table class="rewards-table">
      <thead><tr><th>Place</th><th>Base prize</th><th>Fee share</th><th>Total now</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p>Totals grow as more entry fees are paid in.</p>`;
  }
  const rows = Object.entries(b.rewards || {})
    .map(([place, amount]) => `<tr><td>${place}</td><td class="total">${usd(amount)}</td></tr>`)
    .join('');
  return rows
    ? `<div class="scroll-x"><table class="rewards-table">
      <thead><tr><th>Place</th><th>Prize</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`
    : '';
}

export function bountyPageHTML(b) {
  const open = isOpen(b);
  return `
    <p><a href="#/">← All bounties</a></p>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary || '')}</p>
    <div class="fact-grid">
      <div class="fact"><div class="fact-label">Live pot</div><div class="fact-value">${livePot(b)}</div><div class="fact-sub">${usd(b.rewardAmount)} base + ${usd(b.entryFeesUsd || 0)} in fees</div></div>
      <div class="fact"><div class="fact-label">Entry fee</div><div class="fact-value">${b.entryFeeUsd ? usd(b.entryFeeUsd) : 'Free'}</div><div class="fact-sub">${count(b.entryFeePayers || 0)} paid</div></div>
      <div class="fact"><div class="fact-label">Deadline</div><div class="fact-value" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</div><div class="fact-sub">${dateStr(b.deadline)}</div></div>
      <div class="fact"><div class="fact-label">Entries</div><div class="fact-value">${count(b.submissionCount)}</div><div class="fact-sub">${open ? 'Still taking entries' : 'Closed to entries'}</div></div>
    </div>
    <p>
      <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
      <a class="btn btn-secondary" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun</a>
      ${statusPill(b)}
    </p>
    <h2>Rewards</h2>
    ${rewardsTableHTML(b)}
    <h2>Description</h2>
    <div class="description">${mdText(b.description || '')}</div>
    ${b.rules ? `<details class="rules-box"><summary>Full rules</summary><pre>${esc(b.rules)}</pre></details>` : ''}
    <p class="meta-line"><span>Category: ${esc(b.category || '—')}</span><span>Skills: ${esc((b.skills || []).join(', '))}</span><span>Published: ${dateStr(b.publishedAt)}</span></p>`;
}

// ------------------------------------------------------------ leaderboard

const PAGE_SIZE = 25;

export function filterEntries(entries, ui) {
  const query = ui.q.trim().toLowerCase();
  if (!query) return entries;
  return entries.filter((e) => `${e.handle || ''} ${e.title || ''}`.toLowerCase().includes(query));
}

export function leaderboardTableHTML(entries, ui) {
  const rows = filterEntries(entries, ui);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(ui.page, pages);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (!rows.length) return '<p class="empty">No entries match that search.</p>';
  const body = slice
    .map((e) => {
      const avatar = e.image
        ? `<img class="avatar" crossorigin="anonymous" src="${esc(imageUrl(e.image))}" alt="${esc((e.handle || '?').slice(0, 1).toUpperCase())}" loading="lazy">`
        : `<span class="avatar" aria-hidden="true">${esc((e.handle || '?').slice(0, 1).toUpperCase())}</span>`;
      return `<tr>
        <td>${count(e.rank)}</td>
        <td><span class="entrant">${avatar}<span><a class="handle" href="${profileHref(e.handle)}">${esc(e.handle)}</a><span class="entry-name">${esc(e.title || '')}</span></span></span></td>
        <td class="rate">${rate(e.values?.judge)}</td>
        <td>${rate(e.values?.judge_low)} – ${rate(e.values?.judge_high)}</td>
        <td>${e.cost?.micro_usd ? usd(Number(e.cost.micro_usd) / 1000000) : '—'}</td>
        <td>${e.values?.valid === 1 ? 'Yes' : '—'}</td>
        <td>${bytes(e.values?.bytes)}</td>
      </tr>`;
    })
    .join('');
  return `<div class="scroll-x"><table class="standings">
    <thead><tr><th>#</th><th>Entrant</th><th>Win rate</th><th>90% interval</th><th>Build cost</th><th>Valid</th><th>Size</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>
  <div class="pager">
    <button class="btn btn-secondary" id="lb-prev" ${page <= 1 ? 'disabled' : ''}>← Previous</button>
    <span class="info">Page ${page} of ${pages} · ${count(rows.length)} entries</span>
    <button class="btn btn-secondary" id="lb-next" ${page >= pages ? 'disabled' : ''}>Next →</button>
  </div>`;
}

export function leaderboardPageHTML(lb, ui) {
  const c = lb.competition || {};
  const entries = lb.entries || [];
  const shown = filterEntries(entries, ui).length;
  const rankColumn = (lb.columns || []).find((col) => col.key === (lb.rank_key || 'judge'));
  return `
    <p><a href="#/bounty/${encodeURIComponent(c.slug || '')}">← ${esc(c.title || 'Bounty')}</a></p>
    <h1>${esc(c.title || 'Leaderboard')}</h1>
    <p class="lede">${esc(lb.title || 'Results')} · ranked by ${esc(rankColumn?.title || 'judge win rate')}.</p>
    <div class="controls">
      <label class="sr-only" for="lb-q">Search entries</label>
      <input type="search" id="lb-q" placeholder="Search handle or entry title…" value="${esc(ui.q)}" autocomplete="off">
      <span class="count" id="lb-count">${shown} of ${entries.length} entries</span>
    </div>
    <div id="lb-table">${leaderboardTableHTML(entries, ui)}</div>`;
}

// ---------------------------------------------------------------- profile

export function profilePageHTML(p) {
  const record = p.record || {};
  const avatar = p.image
    ? `<img class="avatar big" crossorigin="anonymous" src="${esc(imageUrl(p.image))}" alt="${esc((p.handle || '?').slice(0, 1).toUpperCase())}">`
    : `<span class="avatar big" aria-hidden="true">${esc((p.handle || '?').slice(0, 1).toUpperCase())}</span>`;
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub @${esc(p.github_login)}</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(p.x)}">X @${esc(p.x)}</a>`);
  if (p.discord) links.push(`<span>Discord ${esc(p.discord)}</span>`);
  if (p.wallet?.address) {
    const explorer = p.wallet.explorer_url || `https://solscan.io/account/${p.wallet.address}`;
    links.push(`<a href="${esc(explorer)}">Wallet ${shortWallet(p.wallet.address)}</a>`);
  }
  const solutions = p.solutions || [];
  const solutionsHTML = solutions.length
    ? `<div class="scroll-x"><table class="standings">
      <thead><tr><th>Entry</th><th>Bounty</th><th>Place</th><th>Prize</th><th>Win rate</th></tr></thead>
      <tbody>${solutions
        .map(
          (s) => `<tr>
            <td>${esc(s.title || '')}</td>
            <td><a href="#/bounty/${encodeURIComponent(s.competition?.slug || '')}">${esc(s.competition?.title || '')}</a></td>
            <td>${s.placement ? count(s.placement) : '—'}</td>
            <td>${s.prize_usd ? usd(s.prize_usd) : '—'}</td>
            <td>${s.score ? rate(s.score.value) : '—'}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table></div>`
    : '<p class="empty">No entries yet.</p>';
  const payouts = p.payouts || [];
  const payoutsHTML = payouts.length
    ? `<ul>${payouts.map((x) => `<li>${esc(x.title || x.id || 'Payout')} — ${usd(x.amount_usd ?? x.amountUsd)}</li>`).join('')}</ul>`
    : '<p class="empty">No prizes claimed yet.</p>';
  return `
    <p><a href="#/">← All bounties</a></p>
    <div class="profile-head">
      ${avatar}
      <div class="profile-id">
        <h1>${esc(p.display_name || p.handle)}</h1>
        <p class="handle-line">@${esc(p.handle)}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <p class="links">${links.join('') || '<span>No links listed</span>'}</p>
      </div>
    </div>
    <div class="fact-grid">
      <div class="fact"><div class="fact-label">Entered</div><div class="fact-value">${count(record.competitions_entered)}</div></div>
      <div class="fact"><div class="fact-label">Placed</div><div class="fact-value">${count(record.competitions_placed)}</div></div>
      <div class="fact"><div class="fact-label">Won</div><div class="fact-value">${count(record.competitions_won)}</div></div>
      <div class="fact"><div class="fact-label">Best place</div><div class="fact-value">${record.best_placement ? count(record.best_placement) : '—'}</div></div>
      <div class="fact"><div class="fact-label">Prize money</div><div class="fact-value">${usd(record.prize_usd)}</div></div>
      <div class="fact"><div class="fact-label">Joined</div><div class="fact-value">${dateStr(p.joined_at).split(',')[0]}</div></div>
    </div>
    <h2>Entries</h2>
    ${solutionsHTML}
    <h2>Payouts</h2>
    ${payoutsHTML}`;
}
