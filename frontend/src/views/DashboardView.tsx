import React, { useEffect, useState } from 'react';
import { BarChart3, Boxes, ClipboardList, CreditCard, ShieldCheck, ShoppingCart, Truck, Users } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { ReportData } from '../types';

const roleContent = {
  owner: {
    title: 'Ringkasan Bisnis',
    subtitle: 'Pantau performa seluruh cabang dan aktivitas bisnis Anda.',
    cards: [
      { label: 'Penjualan hari ini', value: 'Rp 0', icon: CreditCard },
      { label: 'Transaksi hari ini', value: '0', icon: ShoppingCart },
      { label: 'Cabang aktif', value: '0', icon: BarChart3 },
      { label: 'Pengguna aktif', value: '0', icon: Users },
    ],
    actions: ['Lihat laporan penjualan', 'Kelola pengguna', 'Tinjau log audit'],
  },
  branch_manager: {
    title: 'Ringkasan Cabang',
    subtitle: 'Pantau penjualan, stok, dan aktivitas operasional cabang.',
    cards: [
      { label: 'Penjualan hari ini', value: 'Rp 0', icon: CreditCard },
      { label: 'Transaksi hari ini', value: '0', icon: ShoppingCart },
      { label: 'Stok menipis', value: '0', icon: Boxes },
      { label: 'Pesanan pasokan', value: '0', icon: Truck },
    ],
    actions: ['Buka laporan cabang', 'Periksa stok menipis', 'Kelola pasokan'],
  },
  cashier: {
    title: 'Dashboard Kasir',
    subtitle: 'Siap melayani transaksi dengan cepat dan akurat.',
    cards: [
      { label: 'Penjualan saya hari ini', value: 'Rp 0', icon: CreditCard },
      { label: 'Transaksi saya', value: '0', icon: ShoppingCart },
      { label: 'Item di keranjang', value: '0', icon: ClipboardList },
    ],
    actions: ['Mulai transaksi baru', 'Lihat riwayat transaksi'],
  },
  inventory_staff: {
    title: 'Dashboard Gudang',
    subtitle: 'Kelola ketersediaan produk dan pergerakan stok.',
    cards: [
      { label: 'Total produk', value: '0', icon: Boxes },
      { label: 'Stok menipis', value: '0', icon: ShieldCheck },
      { label: 'Pasokan berjalan', value: '0', icon: Truck },
    ],
    actions: ['Kelola inventaris', 'Kelola supplier'],
  },
} as const;

export const DashboardView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, currentBranch } = useAuthStore();
  const content = roleContent[user?.role as keyof typeof roleContent] ?? roleContent.cashier;
  const [selectedRange, setSelectedRange] = useState('1 hari');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const ranges = [
    { label: '1 hari', days: 1 },
    { label: '3 hari', days: 3 },
    { label: '7 hari', days: 7 },
    { label: '14 hari', days: 14 },
    { label: '1 bulan', days: 30 },
  ];

  useEffect(() => {
    if (!currentBranch || (user?.role !== 'owner' && user?.role !== 'branch_manager')) return;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const selectedDays = ranges.find((range) => range.label === selectedRange)?.days ?? 1;
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (selectedDays - 1));
        const toDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const data = await apiRequest<ReportData>(
          `/reports/summary?start_date=${toDate(start)}&end_date=${toDate(end)}`,
        );
        setReport(data);
      } catch (error) {
        console.error('Gagal memuat ringkasan dashboard:', error);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [currentBranch, selectedRange, user?.role]);

  const summary = report?.summary;
  const formatIDR = (value: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
  const cards = content.cards.map((card) => {
    if (!summary) return card;
    if (card.label.includes('Penjualan')) return { ...card, value: formatIDR(summary.total_sales) };
    if (card.label.includes('Transaksi')) return { ...card, value: String(summary.total_orders) };
    return card;
  });

  return (
    <section className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Sentosa POS</p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{content.title}</h1>
            <p className="mt-1 text-sm text-slate-400">Halo, {user?.full_name}. {content.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label htmlFor="dashboard-range" className="sr-only">Rentang waktu dashboard</label>
            <select
              id="dashboard-range"
              value={selectedRange}
              onChange={(event) => setSelectedRange(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition focus:border-emerald-500"
            >
              {ranges.map((range) => <option key={range.label} value={range.label}>{range.label}</option>)}
            </select>
            {currentBranch && <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">Cabang: <strong className="text-white">{currentBranch.name}</strong></div>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between"><span className="text-xs font-medium text-slate-400">{label}</span><div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><Icon className="h-4 w-4" /></div></div>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="mt-2 text-[11px] text-slate-500">Data akan mengikuti cabang dan periode aktif</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Aktivitas {selectedRange.toLowerCase()}</h2>
                <p className="mt-1 text-xs text-slate-500">Ringkasan berubah otomatis saat periode diganti.</p>
              </div>
              {loading && <span className="text-xs text-emerald-400">Memuat...</span>}
            </div>
            {report?.top_products?.length ? (
              <div className="mt-5 flex flex-col gap-2">
                {report.top_products.slice(0, 5).map((product) => (
                  <div key={product.product_id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-xs">
                    <span className="truncate text-slate-300">{product.product_name}</span>
                    <span className="ml-3 font-semibold text-emerald-400">{product.total_qty} terjual</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-800 text-center text-sm text-slate-500">Belum ada aktivitas untuk periode ini.</div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-sm font-bold text-white">Akses cepat</h2><div className="mt-4 flex flex-col gap-2">{content.actions.map((action) => { const tab = action.includes('laporan') ? 'reports' : action.includes('stok') || action.includes('inventaris') ? 'inventory' : action.includes('pasokan') || action.includes('supplier') ? 'suppliers' : action.includes('transaksi') ? 'pos' : action.includes('audit') ? 'audit-logs' : 'settings'; return <button key={action} onClick={() => onNavigate(tab)} className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-3 text-left text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white"><span>{action}</span><span className="text-emerald-400">→</span></button>; })}</div></div>
        </div>
      </div>
    </section>
  );
};
