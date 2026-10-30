/** Короткие звуки кассы: успех / ошибка (ТЗ 11.1). Без файлов — WebAudio. */
let ctx: AudioContext | null = null;
function beep(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.06) {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* звук недоступен — не мешаем работе */
  }
}
export const sound = {
  ok: () => beep(1320, 70),
  error: () => {
    beep(220, 140, 'square', 0.04);
    setTimeout(() => beep(180, 160, 'square', 0.04), 150);
  },
};
export const vibrate = (ms = 30) => navigator.vibrate?.(ms);
