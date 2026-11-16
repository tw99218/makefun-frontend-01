// Small helpers for showing API values.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** A dollar amount ('1000.00', '0.50' or 500) as '$1,000' or '$0.50'. */
export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A count with thousands separators. */
export function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A deadline as a date in UTC. */
export function dateStr(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Whether a bounty still takes entries: by its deadline, not its status. */
export function isOpen(bounty) {
  if (bounty.acceptingSubmissions === false) return false;
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** A judge win rate stored in micros (962052) as '96.2%'. */
export function rate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(1)}%`;
}

/** A byte count as '1.4 MB'. */
export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A wallet address shortened to its first and last four characters. */
export function shortWallet(address) {
  const s = String(address || '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}
