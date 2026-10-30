import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, PackageCheck, ShoppingCart, TrendingUp, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { ReportData } from '../types';

const roleContent = {
  owner: {
    title: 'Ringkasan Eksekutif Bisnis',
    subtitle: 'Pantau omset penjualan, pergerakan produk, dan kinerja staf seluruh cabang.',
    cards: [
      { label: 'Total Penjualan', value: 'Rp 0', icon: CreditCard, key: 'sales', change: '+12.5%' },
      { label: 'Jumlah Transaksi', value: '0', icon: ShoppingCart, key: 'orders', change: '+8.2%' },
      { label: 'Total Item Terjual', value: '0', icon: PackageCheck, key: 'items', change: '+15.1%' },
      { label: 'Rata-rata Order (AOV)', value: 'Rp 0', icon: TrendingUp, key: 'average', change: '+4.0%' },
    ],
  },
  branch_manager: {
    title: 'Ringkasan Operasional Cabang',
    subtitle: 'Pantau penjualan kasir, ketersediaan produk, dan aktivitas harian cabang.',
    cards: [
      { label: 'Penjualan Cabang', value: 'Rp 0', icon: CreditCard, key: 'sales', change: '+10.2%' },
      { label: 'Transaksi Selesai', value: '0', icon: ShoppingCart, key: 'orders', change: '+6.5%' },
      { label: 'Item Terjual', value: '0', icon: PackageCheck, key: 'items', change: '+12.0%' },
      { label: 'Rata-rata Order', value: 'Rp 0', icon: TrendingUp, key: 'average', change: '+3.5%' },
    ],
  },
  cashier: {
    title: 'Dashboard Terminal Kasir',
    subtitle: 'Pantau transaksi yang berhasil diselesaikan pada shift aktif saat ini.',
    cards: [
      { label: 'Total Penjualan Shift', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Transaksi Terlayani', value: '0', icon: ShoppingCart, key: 'orders' },
      { label: 'Produk Terjual', value: '0', icon: PackageCheck, key: 'items' },
    ],
  },
  inventory_staff: {
    title: 'Dashboard Manajemen Stok',
    subtitle: 'Pantau volume barang keluar dari transaksi penjualan untuk kebutuhan restock.',
    cards: [
      { label: 'Nilai Penjualan Barang', value: 'Rp 0', icon: CreditCard, key: 'sales' },
      { label: 'Total Unit Keluar', value: '0', icon: PackageCheck, key: 'items' },
      { label: 'Frekuensi Order', value: '0', icon: ShoppingCart, key: 'orders' },
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
      orders: new Intl.NumberFormat('id-ID').format(summary.total_orders),
      items: new Intl.NumberFormat('id-ID').format(summary.items_sold),
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
    if (user?.role === 'owner') {
      return [
        { tab: 'pos', label: 'Buka Kasir POS', desc: 'Mulai transaksi penjualan baru' },
        { tab: 'reports', label: 'Laporan Penjualan', desc: 'Analisis omset dan performa' },
        { tab: 'inventory', label: 'Manajemen Stok', desc: 'Cek stok barang & mutasi' },
        { tab: 'settings', label: 'Pengaturan Toko', desc: 'Kelola cabang & staf' },
      ];
    }
    if (user?.role === 'inventory_staff') {
      return [
        { tab: 'inventory', label: 'Inventaris Produk', desc: 'Kelola stok fisik gudang' },
        { tab: 'suppliers', label: 'Supplier & Restock', desc: 'Input pasokan barang masuk' },
      ];
    }
    if (user?.role === 'cashier') {
      return [
        { tab: 'pos', label: 'Kasir Penjualan', desc: 'Buka terminal transaksi' },
        { tab: 'sales', label: 'Riwayat Transaksi', desc: 'Cari struk dan cetak ulang' },
      ];
    }
    return [
      { tab: 'pos', label: 'Kasir Penjualan', desc: 'Mulai pesanan kasir' },
      { tab: 'reports', label: 'Laporan Cabang', desc: 'Lihat rekapitulasi penjualan' },
      { tab: 'inventory', label: 'Inventaris', desc: 'Pantau ketersediaan barang' },
      { tab: 'suppliers', label: 'Supplier', desc: 'Penerimaan pasokan baru' },
    ];
  }, [user?.role]);

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-6">
      {/* Top Header Section */}
      <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Ringkasan Sistem</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {currentBranch && (
              <span className="text-xs text-slate-400">
                • Cabang <strong className="text-white font-medium">{currentBranch.name}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{content.title}</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-400">Halo, {user?.full_name}. {content.subtitle}</p>
        </div>

        {/* Period Filter Selector */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center gap-1 bg-[#0b1019] border border-white/[0.08] p-1 rounded-lg">
            {ranges.map((range) => (
              <button
                key={range.label}
                onClick={() => setSelectedRange(range.label)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  selectedRange === range.label
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* KPI Cards Row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{label}</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">{value}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <span>Periode {selectedRange} terakhir</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Products & Payment Breakdown */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Top Products Volume */}
        <div className="rounded-xl border border-white/[0.07] bg-[#0e1520] p-4 sm:p-5">
          <div className="flex items-start justify-between border-b border-white/[0.06] pb-3">
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400">Volume Terlaris</p>
              <h2 className="mt-0.5 text-sm sm:text-base font-bold text-white">Produk Paling Banyak Dibeli</h2>
            </div>
            {loading && <span className="text-xs text-emerald-400 font-mono animate-pulse">Memperbarui...</span>}
          </div>

          {topProducts.length ? (
            <div className="mt-4 space-y-3.5">
              {topProducts.map((product, idx) => (
                <div key={product.product_id} className="space-y-1.5">
                  <div className="flex justify-between items-baseline text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate font-semibold text-slate-200">{product.product_name}</span>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="text-emerald-400 font-bold">{product.total_qty}</span>
                      <span className="text-slate-500 text-[11px] ml-1">terjual</span>
                      <span className="text-slate-400 text-[11px] ml-2">({formatIDR(product.total_sales)})</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.max((product.total_qty / maxProductQty) * 100, 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-8 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500 text-center p-4">
              <PackageCheck className="w-6 h-6 mb-2 text-slate-600 stroke-[1.5]" />
              Belum ada data penjualan pada rentang periode ini.
            </div>
          )}
        </div>

        {/* Payment Composition Breakdown */}
        <div className="rounded-xl border border-white/[0.07] bg-[#0e1520] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="border-b border-white/[0.06] pb-3">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400">Komposisi Pendapatan</p>
              <h2 className="mt-0.5 text-sm sm:text-base font-bold text-white">Metode Pembayaran Kasir</h2>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-center gap-5">
              {/* Circular gauge */}
              <div
                className="relative grid size-28 shrink-0 place-items-center rounded-full shadow-inner"
                style={{ background: `conic-gradient(#10b981 ${cashPercent}%, #3b82f6 ${cashPercent}% 100%)` }}
              >
                <div className="grid size-20 place-items-center rounded-full bg-[#0e1520] border border-white/[0.06]">
                  <span className="text-lg font-bold text-white font-mono">{cashPercent}%</span>
                  <span className="text-[9px] font-mono text-slate-500 -mt-1">TUNAI</span>
                </div>
              </div>

              {/* Legend details */}
              <div className="flex flex-col gap-3 text-xs w-full">
                <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-300">Tunai (Cash)</span>
                  </div>
                  <strong className="text-white font-mono">{formatIDR(summary?.cash_sales ?? 0)}</strong>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-300">Non-Tunai (QRIS/Transfer)</span>
                  </div>
                  <strong className="text-white font-mono">{formatIDR(summary?.non_cash_sales ?? 0)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.07] pt-3 text-xs text-slate-400 flex justify-between items-center">
            <span>Total omset periode ini</span>
            <strong className="text-emerald-400 font-mono text-sm font-bold">{formatIDR(summary?.total_sales ?? 0)}</strong>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts Grid */}
      <div className="rounded-xl border border-white/[0.07] bg-[#0e1520] p-4 sm:p-5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400">Navigasi Langsung</p>
        <h2 className="mt-0.5 text-sm sm:text-base font-bold text-white mb-3">Aksi Cepat Operasional</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ tab, label, desc }) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className="p-3.5 rounded-lg bg-[#080d15] hover:bg-[#111827] border border-white/[0.06] hover:border-emerald-500/30 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                  {label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Staff Leaderboard (Owner & Manager View) */}
      {user?.role === 'owner' && performers.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#0e1520] p-4 sm:p-5">
          <div className="border-b border-white/[0.06] pb-3 mb-4">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400">Produktivitas Tim</p>
            <h2 className="mt-0.5 text-sm sm:text-base font-bold text-white">Kontribusi Omset Per Kasir</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {performers.map((person) => (
              <div key={person.cashier_name} className="p-3 bg-[#080d15] border border-white/[0.06] rounded-lg">
                <div className="flex justify-between items-baseline mb-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[10px] flex items-center justify-center">
                      {person.cashier_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-200 truncate">{person.cashier_name}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">{formatIDR(person.total_sales)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1.5 font-mono">
                  <span>{person.total_orders} transaksi</span>
                  <span>{Math.round((person.total_sales / maxPerformance) * 100)}% dari top</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max((person.total_sales / maxPerformance) * 100, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
