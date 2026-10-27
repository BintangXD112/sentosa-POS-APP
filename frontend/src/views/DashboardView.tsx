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
    <section className="min-h-screen bg-[var(--app-bg)] p-4 text-[var(--text-primary)] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Ringkasan Sistem</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{content.title}</h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-400">Halo, {user?.full_name}. {content.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentBranch && (
              <div className="rounded-lg border border-white/[0.08] bg-[#0e1520] px-3 py-1.5 text-xs text-slate-400">
                Cabang <strong className="text-white font-medium ml-1">{currentBranch.name}</strong>
              </div>
            )}
            <label htmlFor="dashboard-range" className="sr-only">Rentang waktu dashboard</label>
            <select
              id="dashboard-range"
              value={selectedRange}
              onChange={(event) => setSelectedRange(event.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#090d14] px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none transition focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 cursor-pointer"
            >
              {ranges.map((range) => <option key={range.label} value={range.label}>{range.label}</option>)}
            </select>
          </div>
        </header>

        {/* KPI Grid */}
        <div className="mb-6 grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-[#0e1520] p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{label}</span>
                <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-emerald-400">
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">{value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{selectedRange} terakhir</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sales Performance & Payment Mix */}
        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <div className="rounded-xl border border-white/[0.08] bg-[#0e1520] p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Produk Terlaris</p>
                <h2 className="mt-0.5 text-base font-bold text-white">Performa Volume Penjualan</h2>
              </div>
              {loading && <span className="text-xs text-emerald-400 font-mono">Memuat...</span>}
            </div>
            {topProducts.length ? (
              <div className="mt-5 flex flex-col gap-3.5">
                {topProducts.map((product) => (
                  <div key={product.product_id}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-slate-200">{product.product_name}</span>
                      <span className="shrink-0 text-slate-400 font-mono">{product.total_qty} unit</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max((product.total_qty / maxProductQty) * 100, 4)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500">
                Belum ada data penjualan pada periode ini.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0e1520] p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Metode Pembayaran</p>
              <h2 className="mt-0.5 text-base font-bold text-white">Komposisi Pendapatan</h2>
              <div className="mt-6 flex items-center gap-5">
                <div className="relative grid size-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#10b981 ${cashPercent}%, #334155 ${cashPercent}% 100%)` }}>
                  <div className="grid size-18 place-items-center rounded-full bg-[#0e1520]">
                    <span className="text-lg font-bold text-white font-mono">{cashPercent}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center">
                    <span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">Tunai</span>
                    <strong className="ml-2 text-white font-mono">{formatIDR(summary?.cash_sales ?? 0)}</strong>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 inline-block size-2 rounded-full bg-slate-600" />
                    <span className="text-slate-400">Non-tunai</span>
                    <strong className="ml-2 text-white font-mono">{formatIDR(summary?.non_cash_sales ?? 0)}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 border-t border-white/[0.08] pt-3 text-xs text-slate-400 flex justify-between items-center">
              <span>Total omset periode ini</span>
              <strong className="text-emerald-400 font-mono text-sm font-bold">{formatIDR(summary?.total_sales ?? 0)}</strong>
            </div>
          </div>
        </div>

        {/* Operational Overview & Quick Access */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <div className="rounded-xl border border-white/[0.08] bg-[#0e1520] p-4 sm:p-5">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Ringkasan Operasional</p>
            <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[#090d14] border border-white/[0.06] p-3.5">
                <p className="text-xs text-slate-400">Total Transaksi</p>
                <p className="mt-1.5 text-lg font-bold text-white font-mono">{summary?.total_orders ?? 0}</p>
              </div>
              <div className="rounded-lg bg-[#090d14] border border-white/[0.06] p-3.5">
                <p className="text-xs text-slate-400">Item Terjual</p>
                <p className="mt-1.5 text-lg font-bold text-white font-mono">{summary?.items_sold ?? 0}</p>
              </div>
              <div className="rounded-lg bg-[#090d14] border border-white/[0.06] p-3.5">
                <p className="text-xs text-slate-400">Rata-rata Order</p>
                <p className="mt-1.5 text-lg font-bold text-white font-mono">{formatIDR(summary?.average_order_value ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0e1520] p-4 sm:p-5">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Akses Cepat</p>
            <div className="mt-2.5 flex flex-col divide-y divide-white/[0.06]">
              {quickActions.map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="flex items-center justify-between py-2.5 text-left text-xs font-medium text-slate-300 transition hover:text-emerald-400 cursor-pointer group"
                >
                  <span>{label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {user?.role === 'owner' && performers.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#0e1520] p-4 sm:p-5">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Performa Kasir</p>
            <h2 className="mt-0.5 text-base font-bold text-white">Kontribusi Penjualan Tim</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {performers.map((person) => (
                <div key={person.cashier_name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-200">{person.cashier_name}</span>
                    <span className="text-slate-400 font-mono">{formatIDR(person.total_sales)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max((person.total_sales / maxPerformance) * 100, 4)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
