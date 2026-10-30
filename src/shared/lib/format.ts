import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ru');

const toNum = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v));

/** 12 345 сом / $ 1 234.50 — разделитель тысяч, валюта (ТЗ 23.8) */
export function money(v: number | string | null | undefined, currency: 'KGS' | 'USD' | string = 'KGS', digits?: number) {
  const n = toNum(v);
  if (n === null || Number.isNaN(n)) return '—';
  const d = digits ?? (currency === 'USD' ? 2 : Number.isInteger(n) ? 0 : 2);
  const s = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  return currency === 'USD' ? `$${s}` : `${s} с`;
}

/** Разбить сумму на целую и дробную часть — крупная цифра + серые копейки, как на референсе */
export function moneyParts(v: number | string | null | undefined) {
  const n = toNum(v) ?? 0;
  const [int, frac] = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).split(',');
  return { int, frac };
}

export function num(v: number | string | null | undefined, digits = 0) {
  const n = toNum(v);
  if (n === null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n);
}

export function compact(v: number | string | null | undefined) {
  const n = toNum(v);
  if (n === null) return '—';
  return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function pct(v: number | null | undefined, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.abs(v).toFixed(digits).replace('.', ',')}%`;
}

export const date = (v: string | Date | null | undefined, f = 'D MMM YYYY') => (v ? dayjs(v).format(f) : '—');
export const ago = (v: string | Date | null | undefined) => (v ? dayjs(v).fromNow() : '—');
export { dayjs };
