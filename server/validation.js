export function positiveInt(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function finiteNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function validCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return validCalendarDate(year, month, day);
}

export function isMonthString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= 1 && month >= 1 && month <= 12;
}

export function text(value, { max = 500 } = {}) {
  if (value === null || value === undefined) return '';
  const result = String(value).trim();
  return result.length <= max ? result : null;
}

export function badRequest(res, error, code = 'INVALID_INPUT') {
  return res.status(400).json({ ok: false, code, error });
}
