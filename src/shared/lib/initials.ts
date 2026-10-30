export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');

/** Стабильный цвет аватара по строке */
const PALETTE = ['#f4b8c8', '#c9d7f5', '#cfe9d6', '#f7dcb4', '#ddd0f2', '#f2c9b8', '#bfe3e8'];
export const avatarColor = (seed?: string | null) => {
  let h = 0;
  for (const c of seed ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
