export const isValidPhone = (p: string) => /^[6-9]\d{9}$/.test(p);
export const isValidOtp = (o: string) => /^\d{6}$/.test(o);
export const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);

export function pad(n: number) { return (n < 10 ? '0' : '') + n; }
export function toDateString(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Checks a typed date (YYYY-MM-DD) and time (HH:MM, 24-hour). Returns an error message or null. */
export function validateWhen(date: string, time: string, now: Date = new Date()): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d) return 'Enter the date like 2026-10-25.';
  if (!t) return 'Enter the time like 08:30 (24-hour).';
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  const when = new Date(y, mo - 1, da, h, mi);
  if (when.getFullYear() !== y || when.getMonth() !== mo - 1 || when.getDate() !== da || h > 23 || mi > 59) return 'That date or time does not exist.';
  if (when.getTime() < now.getTime() + 30 * 60 * 1000) return 'Pick a time at least 30 minutes from now.';
  return null;
}

export function greeting(now: Date = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
export const firstName = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] || 'there';
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
