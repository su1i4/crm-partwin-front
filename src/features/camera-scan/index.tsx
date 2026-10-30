import * as D from '@radix-ui/react-dialog';
import { useMutation } from '@tanstack/react-query';
import { Barcode, Camera, Flashlight, RefreshCcw, ScanText, SwitchCamera, Undo2, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ProductThumb } from '@/entities/product';
import { api, ApiError, errorMessage, type SearchItem } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { money, num } from '@/shared/lib/format';
import { sound, vibrate } from '@/shared/lib/sound';
import { Button, Pill, Segmented } from '@/shared/ui';

/**
 * Камера (ТЗ 11.2–11.3): штрихкоды — нативный BarcodeDetector, где он есть, иначе @zxing/browser;
 * режим «Номер» — снимок рамки → сервер распознавания (PaddleOCR) → кандидаты. Без сети работают только штрихкоды.
 */

interface OcrResult {
  id: string;
  candidates: { text: string; value: string; kind: string; found: boolean; products: SearchItem[]; suppliers: { supplierName: string; price: string; currency: string }[] }[];
  best: { value: string; found: boolean } | null;
  actions: { type: string; number?: string }[];
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string; format: string }[]> };
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'];

async function makeDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported = (await BD.getSupportedFormats?.()) ?? FORMATS;
    return new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
  } catch {
    return null;
  }
}

/** Сжать кадр рамки до ~300 КБ перед отправкой (ТЗ 11.3) */
function grabFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return Promise.resolve(null);
  // Рамка-подсказка: центральные 80% × 35%
  const cw = Math.round(w * 0.8);
  const ch = Math.round(h * 0.35);
  const scale = Math.min(1, 1280 / cw);
  const c = document.createElement('canvas');
  c.width = Math.round(cw * scale);
  c.height = Math.round(ch * scale);
  c.getContext('2d')!.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.75));
}

export function CameraScanDialog({
  open,
  onOpenChange,
  onCode,
  onProduct,
  onUndo,
  allowOcr,
  single,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Штрихкод распознан (непрерывный режим — много раз) */
  onCode: (code: string) => void | Promise<void>;
  /** Выбран товар из распознанного номера */
  onProduct?: (p: SearchItem) => void;
  /** «Отменить» последний скан */
  onUndo?: (code: string) => void;
  allowOcr: boolean;
  /** Одиночный режим: скан → закрыть */
  single?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopZxing = useRef<(() => void) | null>(null);
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [mode, setMode] = useState<'barcode' | 'number'>('barcode');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<{ min: number; max: number; value: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [ocr, setOcr] = useState<OcrResult | null>(null);

  const stop = useCallback(() => {
    stopZxing.current?.();
    stopZxing.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const hit = useCallback(
    (code: string) => {
      const now = Date.now();
      // Тот же код повторно — не раньше чем через 1.8 с (ТЗ 11.2)
      if (code === lastCode.current.code && now - lastCode.current.at < 1800) return;
      lastCode.current = { code, at: now };
      sound.ok();
      vibrate(40);
      setFlash(true);
      setTimeout(() => setFlash(false), 250);
      setRecent((r) => [code, ...r].slice(0, 3));
      void onCode(code);
      if (single) onOpenChange(false);
    },
    [onCode, single, onOpenChange],
  );

  useEffect(() => {
    if (!open) {
      stop();
      setOcr(null);
      setRecent([]);
      return;
    }
    let cancelled = false;
    let raf = 0;
    (async () => {
      setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Браузер не даёт доступ к камере (нужен HTTPS)');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        const track = s.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
        setZoom(caps.zoom ? { min: caps.zoom.min, max: caps.zoom.max, value: caps.zoom.min } : null);
        if (mode !== 'barcode') return;
        const det = await makeDetector();
        if (det) {
          let busy = false;
          const loop = async () => {
            if (cancelled) return;
            if (!busy && v.readyState >= 2) {
              busy = true;
              try {
                const codes = await det.detect(v);
                if (codes[0]) hit(codes[0].rawValue);
              } catch {
                /* кадр не готов */
              }
              busy = false;
            }
            raf = window.setTimeout(loop, 120) as unknown as number;
          };
          void loop();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const ctrl = await reader.decodeFromVideoElement(v, (res) => res && hit(res.getText()));
          stopZxing.current = () => ctrl.stop();
        }
      } catch (e) {
        const name = (e as DOMException)?.name;
        const msg =
          name === 'NotAllowedError'
            ? 'Доступ к камере запрещён. Разрешите камеру в настройках сайта (значок замка в адресной строке).'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'Камера не найдена. Подключите веб-камеру или откройте кассу на телефоне.'
              : name === 'NotReadableError'
                ? 'Камера занята другой программой'
                : errorMessage(e);
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(raf);
      stop();
    };
  }, [open, facing, mode, hit, stop]);

  const applyTorch = async (v: boolean) => {
    const t = stream.current?.getVideoTracks()[0];
    try {
      await t?.applyConstraints({ advanced: [{ torch: v } as MediaTrackConstraintSet] });
      setTorch(v);
    } catch {
      toast('Фонарик на этой камере недоступен');
    }
  };
  const applyZoom = async (value: number) => {
    const t = stream.current?.getVideoTracks()[0];
    try {
      await t?.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
      setZoom((z) => (z ? { ...z, value } : z));
    } catch {
      /* зум не поддерживается */
    }
  };

  const recognize = useMutation({
    mutationFn: async () => {
      const blob = await grabFrame(video.current!);
      if (!blob) throw new Error('Камера ещё не готова');
      const fd = new FormData();
      fd.append('file', blob, 'frame.jpg');
      fd.append('context', 'pos');
      return api.post<OcrResult>('/ocr/recognize', fd).then((r) => r.data);
    },
    onSuccess: (r) => {
      setOcr(r);
      if (r.candidates.some((c) => c.found)) sound.ok();
      else sound.error();
    },
    onError: (e) => toast.error(e instanceof ApiError && e.code === 'OCR_UNAVAILABLE' ? 'Распознавание номеров не подключено на сервере — введите номер вручную' : errorMessage(e)),
  });

  const products = ocr?.candidates.flatMap((c) => c.products.map((p) => ({ ...p, _via: c.value }))) ?? [];

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <D.Content className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none sm:inset-auto sm:top-[5vh] sm:left-1/2 sm:h-[88vh] sm:w-[min(560px,calc(100vw-32px))] sm:-translate-x-1/2 sm:overflow-hidden sm:rounded-[32px]">
          <D.Title className="sr-only">Камера</D.Title>
          <div className="relative min-h-0 flex-1">
            <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
            {/* Рамка-подсказка */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div
                className={cn(
                  'rounded-[28px] border-[3px] transition-colors',
                  flash ? 'border-ok' : 'border-white/80',
                  mode === 'barcode' ? 'h-[28%] w-[78%]' : 'h-[35%] w-[80%] border-dashed',
                )}
                style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,.35)' }}
              />
            </div>
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-4">
              <Segmented
                size="sm"
                value={mode}
                onChange={(m) => (setMode(m), setOcr(null))}
                className="bg-black/40 ring-white/20 [&_button]:text-white [&_button[aria-selected=true]]:bg-white [&_button[aria-selected=true]]:text-black"
                options={[
                  { value: 'barcode', label: <span className="flex items-center gap-1.5"><Barcode className="size-3.5" />Штрихкод</span> },
                  ...(allowOcr ? [{ value: 'number' as const, label: <span className="flex items-center gap-1.5"><ScanText className="size-3.5" />Номер</span> }] : []),
                ]}
              />
              <D.Close className="grid size-10 place-items-center rounded-full bg-black/40" aria-label="Закрыть">
                <X className="size-5" />
              </D.Close>
            </div>
            {error && (
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-[22px] bg-black/80 p-5 text-center text-sm">
                <Camera className="mx-auto mb-2 size-6 opacity-70" />
                {error}
              </div>
            )}
            {mode === 'number' && !ocr && !error && (
              <div className="absolute inset-x-0 bottom-28 text-center text-sm text-white/80">Наведите на номер детали. Блики — включите фонарик или наклоните деталь.</div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4">
              <button onClick={() => applyTorch(!torch)} className={cn('grid size-12 place-items-center rounded-full', torch ? 'bg-white text-black' : 'bg-black/40')} aria-label="Фонарик">
                <Flashlight className="size-5" />
              </button>
              {mode === 'number' && (
                <button
                  onClick={() => recognize.mutate()}
                  disabled={recognize.isPending}
                  className="flex h-14 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-60"
                >
                  {recognize.isPending ? <span className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <ScanText className="size-5" />}
                  Распознать
                </button>
              )}
              <button onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')} className="grid size-12 place-items-center rounded-full bg-black/40" aria-label="Другая камера">
                <SwitchCamera className="size-5" />
              </button>
              {zoom && zoom.max > zoom.min && (
                <label className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-2">
                  <ZoomIn className="size-4" />
                  <input type="range" min={zoom.min} max={zoom.max} step={0.1} value={zoom.value} onChange={(e) => applyZoom(Number(e.target.value))} className="w-20 accent-white" />
                </label>
              )}
            </div>
          </div>

          {mode === 'barcode' && recent.length > 0 && (
            <div className="space-y-1 bg-black p-3">
              {recent.map((c, i) => (
                <div key={c + i} className="flex items-center justify-between rounded-full bg-white/10 py-1.5 pr-1.5 pl-4 text-sm">
                  <span className="font-mono">{c}</span>
                  {onUndo && i === 0 && (
                    <button onClick={() => (onUndo(c), setRecent((r) => r.slice(1)))} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs">
                      <Undo2 className="size-3.5" /> Отменить
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {mode === 'number' && ocr && (
            <div className="scroll-thin max-h-[45%] space-y-2 overflow-y-auto bg-card p-3 text-ink">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-medium">{products.length ? 'Найдено' : 'Не нашли в каталоге'}</span>
                <Button size="sm" variant="ghost" onClick={() => setOcr(null)}>
                  <RefreshCcw /> Ещё раз
                </Button>
              </div>
              {products.map((p) => (
                <button key={p.id} onClick={() => (onProduct?.(p), onOpenChange(false))} className="flex w-full items-center gap-3 rounded-[18px] p-2 text-left ring-1 ring-line hover:ring-ink">
                  <ProductThumb fileId={p.photoFileId} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.brandName} · <span className="font-mono">{p.mainNumber}</span>
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <b className="tabular-nums">{money(p.price)}</b>
                    <span className="block text-xs text-muted">{num(p.stockHere, 3)} шт</span>
                  </span>
                </button>
              ))}
              {!products.length && (
                <div className="flex flex-wrap gap-1.5 px-1 pb-1">
                  {ocr.candidates.slice(0, 5).map((c) => (
                    <Pill key={c.value} tone="outline" className="font-mono">
                      {c.value}
                    </Pill>
                  ))}
                  {ocr.candidates.some((c) => c.suppliers.length) && <div className="w-full text-xs text-muted">Есть у поставщика — создайте товар из прайса (этап 4)</div>}
                  {ocr.best && (
                    <Button size="sm" variant="dark" onClick={() => (void onCode(ocr.best!.value), onOpenChange(false))}>
                      Искать «{ocr.best.value}»
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
