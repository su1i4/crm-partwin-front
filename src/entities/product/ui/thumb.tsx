import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { api } from '@/shared/api';
import { cn } from '@/shared/lib/cn';

/** Миниатюра товара: временная ссылка на 10 минут (POST /files/:id/link), иначе — заглушка со штриховкой */
export function ProductThumb({ fileId, size = 40, className }: { fileId: string | null; size?: number; className?: string }) {
  const { data } = useQuery({
    queryKey: ['file-link', fileId],
    queryFn: () => api.post<{ url: string }>(`/files/${fileId}/link`).then((r) => r.data.url),
    enabled: !!fileId,
    staleTime: 8 * 60_000,
    retry: false,
  });
  return (
    <span className={cn('hatch inline-grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-card-muted text-faint ring-1 ring-line', className)} style={{ width: size, height: size }}>
      {data ? <img src={data} alt="" className="size-full object-cover" /> : <Package className="size-[45%]" strokeWidth={1.6} />}
    </span>
  );
}
