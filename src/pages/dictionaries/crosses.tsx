import { useMutation } from '@tanstack/react-query';
import { ArrowLeftRight, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ProductAddField, type PickedProduct } from '@/features/product-add';
import { CrossesBlock } from '@/pages/product/tabs';
import { api, errorMessage } from '@/shared/api';
import { Button, Card, Field, Input, PageTitle, Tray } from '@/shared/ui';

type Form = { aNumber: string; aBrand: string; bNumber: string; bBrand: string; crossType: 'full' | 'partial' | 'oem_replacement' };
const empty: Form = { aNumber: '', aBrand: '', bNumber: '', bBrand: '', crossType: 'full' };

/** Аналоги (ТЗ 4.3): ручной кросс «номер = номер» и просмотр кроссов товара. Массово — импорт из Excel */
export default function CrossesPage() {
  const [f, setF] = useState<Form>(empty);
  const [p, setP] = useState<PickedProduct | null>(null);
  const add = useMutation({
    mutationFn: () =>
      api.post('/crosses', {
        aNumber: f.aNumber.trim(),
        bNumber: f.bNumber.trim(),
        crossType: f.crossType,
        ...(f.aBrand.trim() ? { aBrand: f.aBrand.trim() } : {}),
        ...(f.bBrand.trim() ? { bBrand: f.bBrand.trim() } : {}),
      }),
    onSuccess: () => (toast.success('Кросс сохранён — аналоги обновятся в поиске'), setF(empty)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <PageTitle
        title="Аналоги"
        sub="Кросс связывает два номера. Аналоги аналогов ищутся до 2 уровня и в выдаче помечаются"
        actions={
          <Link to="/settings/import">
            <Button>
              <FileSpreadsheet /> Импорт кроссов
            </Button>
          </Link>
        }
      />
      <Card className="p-5">
        <div className="mb-3 text-[15px] font-medium">Новый кросс</div>
        <div className="grid items-end gap-3 lg:grid-cols-[1fr_1fr_auto_1fr_1fr_180px_auto]">
          <Field label="Номер">
            <Input value={f.aNumber} onChange={(e) => setF({ ...f, aNumber: e.target.value })} className="font-mono" placeholder="04465-33450" />
          </Field>
          <Field label="Бренд">
            <Input value={f.aBrand} onChange={(e) => setF({ ...f, aBrand: e.target.value })} placeholder="Toyota" />
          </Field>
          <ArrowLeftRight className="mb-3 hidden size-5 text-accent lg:block" />
          <Field label="Аналог">
            <Input value={f.bNumber} onChange={(e) => setF({ ...f, bNumber: e.target.value })} className="font-mono" placeholder="MS-2393" />
          </Field>
          <Field label="Бренд">
            <Input value={f.bBrand} onChange={(e) => setF({ ...f, bBrand: e.target.value })} placeholder="Masuma" />
          </Field>
          <Field label="Тип">
            <select value={f.crossType} onChange={(e) => setF({ ...f, crossType: e.target.value as Form['crossType'] })} className="h-11 w-full rounded-full bg-card px-4 text-sm ring-1 ring-line outline-none">
              <option value="full">полная замена</option>
              <option value="partial">частичная</option>
              <option value="oem_replacement">замена OEM</option>
            </select>
          </Field>
          <Button variant="dark" size="lg" disabled={!f.aNumber.trim() || !f.bNumber.trim()} loading={add.isPending} onClick={() => add.mutate()}>
            Связать
          </Button>
        </div>
      </Card>
      <Tray className="space-y-3 p-4">
        <div className="text-[15px] font-medium">Кроссы товара</div>
        <ProductAddField autoFocus={false} onPick={setP} placeholder="Найдите товар — покажем его кроссы" />
        {p && (
          <div className="rounded-[22px] bg-card p-4">
            <Link to={`/products/${p.id}`} className="text-[15px] font-medium hover:text-accent">
              {p.name}
            </Link>
            <div className="font-mono text-xs text-muted">
              {p.mainNumber ?? p.sku} · {p.brandName ?? 'без бренда'}
            </div>
            <CrossesBlock productId={p.id} mainNumber={p.mainNumber} brand={p.brandName} />
          </div>
        )}
      </Tray>
    </div>
  );
}
