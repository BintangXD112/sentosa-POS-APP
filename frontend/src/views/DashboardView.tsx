import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, CreditCard, PackageCheck, ShoppingCart } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { ReportData } from '../types';

const roleContent = {
  owner: {
    title: 'Ringkasan Bisnis',
    subtitle: 'Pantau performa seluruh cabang dan aktivitas bisnis Anda.',
    cards: [
      { label: 'Penjualan periode', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Transaksi periode', value: '0', icon: ShoppingCart, key: 'orders' },
      { label: 'Produk terjual', value: '0', icon: PackageCheck, key: 'items' },
      { label: 'Rata-rata transaksi', value: 'Rp 0', icon: BarChart3, key: 'average' },
    ],
  },
  branch_manager: {
    title: 'Ringkasan Cabang',
    subtitle: 'Pantau penjualan, stok, dan aktivitas operasional cabang.',
    cards: [
      { label: 'Penjualan periode', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Transaksi periode', value: '0', icon: ShoppingCart, key: 'orders' },
      { label: 'Produk terjual', value: '0', icon: PackageCheck, key: 'items' },
      { label: 'Rata-rata transaksi', value: 'Rp 0', icon: BarChart3, key: 'average' },
    ],
  },
  cashier: {
    title: 'Dashboard Kasir',
    subtitle: 'Siap melayani transaksi dengan cepat dan akurat.',
    cards: [
      { label: 'Penjualan periode', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Transaksi periode', value: '0', icon: ShoppingCart, key: 'orders' },
      { label: 'Produk terjual', value: '0', icon: PackageCheck, key: 'items' },
    ],
  },
  inventory_staff: {
    title: 'Dashboard Gudang',
    subtitle: 'Kelola ketersediaan produk dan pergerakan stok.',
    cards: [
      { label: 'Penjualan periode', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Produk terjual', value: '0', icon: PackageCheck, key: 'items' },
      { label: 'Transaksi periode', value: '0', icon: ShoppingCart, key: 'orders' },
    ],
  },
} as const;

const ranges = [
  { label: '1 hari', days: 1 },
  { label: '3 hari', days: 3 },
  { label: '7 hari', days: 7 },
  { label: '14 hari', days: 14 },
  { label: '1 bulan', days: 30 },
];

export const DashboardView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, currentBranch } = useAuthStore();
  const content = roleContent[user?.role as keyof typeof roleContent] ?? roleContent.cashier;
  const [selectedRange, setSelectedRange] = useState('7 hari');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedDays = ranges.find((range) => range.label === selectedRange)?.days ?? 7;

  useEffect(() => {
    if (!currentBranch) return;
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (selectedDays - 1));
        const toDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const data = await apiRequest<ReportData>(`/reports/summary?start_date=${toDate(start)}&end_date=${toDate(end)}`);
        setReport(data);
      } catch (error) {
        console.error('Gagal memuat ringkasan dashboard:', error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [currentBranch, selectedDays]);

  const formatIDR = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  const summary = report?.summary;
  const cards = content.cards.map((card) => {
    if (!summary) return card;
    const values: Record<string, string> = {
      sales: formatIDR(summary.total_sales),
      orders: String(summary.total_orders),
      items: String(summary.items_sold),
      average: formatIDR(summary.average_order_value),
    };
    return { ...card, value: values[card.key] };
  });
  const paymentTotal = (summary?.cash_sales ?? 0) + (summary?.non_cash_sales ?? 0);
  const cashPercent = paymentTotal ? Math.round(((summary?.cash_sales ?? 0) / paymentTotal) * 100) : 0;
  const topProducts = report?.top_products?.slice(0, 5) ?? [];
  const maxProductQty = Math.max(...topProducts.map((product) => product.total_qty), 1);
  const performers = report?.cashier_performance?.slice(0, 5) ?? [];
  const maxPerformance = Math.max(...performers.map((person) => person.total_sales), 1);
  const quickActions = useMemo(() => {
    const actions = user?.role === 'owner'
      ? [['reports', 'Lihat laporan penjualan'], ['settings', 'Pengaturan aplikasi'], ['audit-logs', 'Tinjau log audit']]
      : user?.role === 'inventory_staff'
        ? [['inventory', 'Kelola inventaris'], ['suppliers', 'Kelola supplier']]
        : user?.role === 'cashier'
          ? [['pos', 'Mulai transaksi baru'], ['sales-history', 'Lihat riwayat transaksi']]
          : [['reports', 'Buka laporan cabang'], ['inventory', 'Periksa inventaris'], ['suppliers', 'Kelola pasokan']];
    return actions;
  }, [user?.role]);

  return (
    <section className="min-h-screen bg-stone-50 p-4 text-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Sentosa POS / Overview</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{content.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Halo, {user?.full_name}. {content.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentBranch && <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Cabang <strong className="text-slate-900">{currentBranch.name}</strong></div>}
            <label htmlFor="dashboard-range" className="sr-only">Rentang waktu dashboard</label>
            <select id="dashboard-range" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
              {ranges.map((range) => <option key={range.label} value={range.label}>{range.label}</option>)}
            </select>
          </div>
        </header>

        <div className="mb-6 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => <div key={label} className="bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><Icon className="h-4 w-4 text-emerald-700" /></div><p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-400">{selectedRange} terakhir</p></div>)}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Produk terlaris</p><h2 className="mt-1 text-lg font-bold text-slate-950">Performa penjualan</h2></div>{loading && <span className="text-xs text-emerald-700">Memuat...</span>}</div>
            {topProducts.length ? <div className="mt-6 flex flex-col gap-4">{topProducts.map((product) => <div key={product.product_id}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{product.product_name}</span><span className="shrink-0 text-slate-500">{product.total_qty} unit</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max((product.total_qty / maxProductQty) * 100, 4)}%` }} /></div></div>)}</div> : <div className="mt-6 flex min-h-32 items-center justify-center rounded-md border border-dashed border-slate-200 text-sm text-slate-400">Belum ada data penjualan pada periode ini.</div>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Metode pembayaran</p><h2 className="mt-1 text-lg font-bold text-slate-950">Komposisi pendapatan</h2><div className="mt-7 flex items-center gap-5"><div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#059669 ${cashPercent}%, #cbd5e1 ${cashPercent}% 100%)` }}><div className="grid size-20 place-items-center rounded-full bg-white"><span className="text-xl font-bold text-slate-950">{cashPercent}%</span></div></div><div className="flex flex-col gap-3 text-xs"><div><span className="mr-2 inline-block size-2 rounded-full bg-emerald-600" />Tunai <strong className="ml-2 text-slate-900">{formatIDR(summary?.cash_sales ?? 0)}</strong></div><div><span className="mr-2 inline-block size-2 rounded-full bg-slate-300" />Non-tunai <strong className="ml-2 text-slate-900">{formatIDR(summary?.non_cash_sales ?? 0)}</strong></div></div></div><div className="mt-7 border-t border-slate-100 pt-4 text-xs text-slate-500">Total pendapatan <strong className="float-right text-slate-900">{formatIDR(summary?.total_sales ?? 0)}</strong></div></div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ringkasan operasional</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-stone-50 p-4"><p className="text-xs text-slate-500">Total transaksi</p><p className="mt-2 text-xl font-bold text-slate-950">{summary?.total_orders ?? 0}</p></div><div className="rounded-md bg-stone-50 p-4"><p className="text-xs text-slate-500">Item terjual</p><p className="mt-2 text-xl font-bold text-slate-950">{summary?.items_sold ?? 0}</p></div><div className="rounded-md bg-stone-50 p-4"><p className="text-xs text-slate-500">Nilai rata-rata</p><p className="mt-2 text-xl font-bold text-slate-950">{formatIDR(summary?.average_order_value ?? 0)}</p></div></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Akses cepat</p><div className="mt-3 flex flex-col gap-1">{quickActions.map(([tab, label]) => <button key={tab} onClick={() => onNavigate(tab)} className="flex items-center justify-between border-b border-slate-100 py-3 text-left text-sm font-medium text-slate-700 transition hover:text-emerald-700"><span>{label}</span><ArrowUpRight className="h-4 w-4" /></button>)}</div></div>
        </div>

        {user?.role === 'owner' && performers.length > 0 && <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Performa kasir</p><h2 className="mt-1 text-lg font-bold text-slate-950">Kontribusi penjualan</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{performers.map((person) => <div key={person.cashier_name}><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-700">{person.cashier_name}</span><span className="text-slate-500">{formatIDR(person.total_sales)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max((person.total_sales / maxPerformance) * 100, 4)}%` }} /></div></div>)}</div></div>}
      </div>
    </section>
  );
};
