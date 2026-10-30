import { useNet } from '../lib/network';

/** Есть ли связь с сервером (не только navigator.onLine) */
export const useOnline = () => useNet((s) => s.online);
