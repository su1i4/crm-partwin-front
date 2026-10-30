import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';
export const useTheme = create<{ theme: Theme; toggle: () => void }>()(
  persist((set, get) => ({ theme: 'light', toggle: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }) }), { name: 'ap.theme' }),
);

export const applyTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0d0d0e' : '#e6e2e2');
};
