import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Car, Hash, Tag, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { productApi } from '@/entities/product';
import { ApiError, errorMessage, type ProductCard } from '@/shared/api';
import { Button, Dialog, Field, Input, Switch } from '@/shared/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Как продавец называет деталь'),
  number: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  price: z.string().trim().regex(/^(\d+([.,]\d{1,2})?)?$/, 'Число').optional(),
  vehicles: z.string().optional(),
  noStockControl: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Быстрое создание товара за 15 секунд (ТЗ 4.7) — POST /products/quick */
export interface CreatedProduct {
  id: string;
  name: string;
  sku: string;
  mainNumber: string | null;
  brandName: string | null;
  baseUnit: string;
  retailPrice: string | null;
}

export function QuickProductDialog({
  open,
  onOpenChange,
  onCreated,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (p: CreatedProduct) => void;
  /** Что искали: номер — в поле номера, текст — в название */
  initial?: string;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset, watch, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { noStockControl: false },
  });
  useEffect(() => {
    if (open && initial) {
      const isNum = /\d/.test(initial) && initial.length < 25 && !/\s\S+\s/.test(initial);
      reset({ noStockControl: false, ...(isNum ? { number: initial } : { name: initial }) });
    }
  }, [open, initial, reset]);
  const m = useMutation({
    mutationFn: (v: Values) =>
      productApi.quick({
        name: v.name,
        ...(v.number ? { number: v.number } : {}),
        ...(v.brand ? { brand: v.brand } : {}),
        ...(v.price ? { price: v.price.replace(',', '.') } : {}),
        ...(v.vehicles ? { vehicles: v.vehicles.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
        noStockControl: v.noStockControl,
      }),
    onSuccess: (card: ProductCard) => {
      toast.success('Товар создан — остальное можно дозаполнить потом');
      onCreated?.({
        id: card.id,
        name: card.name,
        sku: card.sku,
        mainNumber: card.mainNumber,
        brandName: card.brand?.name ?? null,
        baseUnit: card.baseUnit,
        retailPrice: card.prices?.[0] ? String(card.prices[0].price) : null,
      });
      qc.invalidateQueries({ queryKey: ['products'] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof ApiError && e.code === 'DUPLICATE' ? 'Такой номер у этого бренда уже есть' : errorMessage(e)),
  });
  const err = formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Новый товар" description="Номер, бренд, название и цена — остальное дозаполните позже.">
      <form onSubmit={handleSubmit((v) => m.mutate(v))} className="mt-5 space-y-4" noValidate>
        <Field label="Название" error={err.name?.message}>
          <Input autoFocus placeholder="Колодки передние" invalid={!!err.name} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Номер детали">
            <Input icon={<Hash />} placeholder="04465-33450" {...register('number')} />
          </Field>
          <Field label="Бренд">
            <Input icon={<Tag />} placeholder="Toyota" {...register('brand')} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Розничная цена, сом" error={err.price?.message}>
            <Input icon={<Wallet />} inputMode="decimal" placeholder="2500" invalid={!!err.price} {...register('price')} />
          </Field>
          <Field label="Для каких машин" hint="Через запятую: камри 40, фит">
            <Input icon={<Car />} placeholder="камри 40" {...register('vehicles')} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Switch checked={watch('noStockControl')} onChange={(v) => setValue('noStockControl', v)} label="Без контроля остатка" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="dark" loading={m.isPending}>
              Создать
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
