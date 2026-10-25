import React from 'react';
import { BarChart3, Boxes, ClipboardList, CreditCard, ShieldCheck, ShoppingCart, Truck, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

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

  return (
    <section className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Sentosa POS</p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{content.title}</h1>
            <p className="mt-1 text-sm text-slate-400">Halo, {user?.full_name}. {content.subtitle}</p>
          </div>
          {currentBranch && <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">Cabang aktif: <strong className="text-white">{currentBranch.name}</strong></div>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {content.cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between"><span className="text-xs font-medium text-slate-400">{label}</span><div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400"><Icon className="h-4 w-4" /></div></div>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="mt-2 text-[11px] text-slate-500">Data akan mengikuti cabang dan periode aktif</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-sm font-bold text-white">Aktivitas hari ini</h2><div className="mt-8 flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-800 text-center text-sm text-slate-500">Belum ada aktivitas untuk ditampilkan.</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-sm font-bold text-white">Akses cepat</h2><div className="mt-4 flex flex-col gap-2">{content.actions.map((action) => { const tab = action.includes('laporan') ? 'reports' : action.includes('stok') || action.includes('inventaris') ? 'inventory' : action.includes('pasokan') || action.includes('supplier') ? 'suppliers' : action.includes('transaksi') ? 'pos' : action.includes('audit') ? 'audit-logs' : 'settings'; return <button key={action} onClick={() => onNavigate(tab)} className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-3 text-left text-xs font-medium text-slate-300 transition hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white"><span>{action}</span><span className="text-emerald-400">→</span></button>; })}</div></div>
        </div>
      </div>
    </section>
  );
};
