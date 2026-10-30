import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';

const d = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export type ColType = 'text' | 'money' | 'qty' | 'percent' | 'int' | 'date' | 'datetime';
export interface ReportMeta {
  code: string;
  group: string;
  title: string;
  filters?: string[];
  groupBy?: { value: string; label: string }[] | null;
  path?: string;
}
export interface ReportResult {
  report: { code: string; title: string };
  filters: Record<string, string | number | undefined>;
  columns: { key: string; title: string; type?: ColType }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  note?: string;
}
export interface ReportView {
  id: string;
  report: string;
  name: string;
  params: Record<string, string>;
  shared: boolean;
  mine: boolean;
}

export const reportApi = {
  catalog: () => d(api.get<{ group: string; title: string; reports: ReportMeta[] }[]>('/reports')),
  run: (code: string, params: Record<string, string>) => d(api.get<ReportResult>(`/reports/${code}`, { params })),
  xlsx: (code: string, params: Record<string, string>) => api.get<Blob>(`/reports/${code}/xlsx`, { params, responseType: 'blob' }).then((r) => r.data),
  pdf: (code: string, params: Record<string, string>) => api.get<Blob>(`/reports/${code}/pdf`, { params, responseType: 'blob' }).then((r) => r.data),
  views: () => d(api.get<ReportView[]>('/reports/views')),
  saveView: (b: { report: string; name: string; params: Record<string, string>; shared?: boolean }) => d(api.post<ReportView>('/reports/views', b)),
  removeView: (id: string) => api.delete(`/reports/views/${id}`),
};

export const useReportCatalog = () => useQuery({ queryKey: ['report-catalog'], queryFn: reportApi.catalog, staleTime: 10 * 60_000 });
export const useReport = (code: string | undefined, params: Record<string, string>) =>
  useQuery({ queryKey: ['report', code, params], queryFn: () => reportApi.run(code!, params), enabled: !!code });
export const useReportViews = () => useQuery({ queryKey: ['report-views'], queryFn: reportApi.views });
