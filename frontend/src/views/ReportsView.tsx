import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Award,
  FileDown
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { exportSalesReportPdf } from '../utils/pdfExport';
import type { ReportData } from '../types';

export const ReportsView: React.FC = () => {
  const { currentBranch, user } = useAuthStore();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days'>('today');

  const loadReports = async () => {
    if (!currentBranch) return;
    setLoading(true);

    try {
      const now = new Date();
      let start = new Date();

      if (dateRange === '7days') {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === '30days') {
        start.setDate(now.getDate() - 30);
      }

      const startStr = start.toISOString().split('T')[0];
      const endStr = now.toISOString().split('T')[0];

      const res = await apiRequest<ReportData>(`/reports/summary?start_date=${startStr}&end_date=${endStr}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [currentBranch, dateRange]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const summary = data?.summary || {
    total_sales: 0,
    total_orders: 0,
    cash_sales: 0,
    non_cash_sales: 0,
    items_sold: 0,
    average_order_value: 0,
  };

  const handleExportPdf = () => {
    if (!data) return;
    exportSalesReportPdf({
      data,
      branchName: currentBranch?.name,
      businessName: user?.business_name || 'Sentosa Retail Group',
      dateRange,
      userName: user?.full_name || 'Petugas Kasir',
    });
  };

  const cashPct = summary.total_sales > 0 ? Math.round((summary.cash_sales / summary.total_sales) * 100) : 50;
  const nonCashPct = 100 - cashPct;

  return (
    <div className={`max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Analisis & Keuangan</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {currentBranch && (
              <span className="text-xs text-slate-400">
                • Cabang <strong className="text-white font-medium">{currentBranch.name}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Laporan & Analitik Penjualan</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ringkasan omset penjualan, perincian arus kas kasir, dan ranking produk cabang
          </p>
        </div>

        {/* Date Selector & Export Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0b1019] border border-white/[0.08] p-1 rounded-lg">
            <button
              onClick={() => setDateRange('today')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                dateRange === 'today'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                dateRange === '7days'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDateRange('30days')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                dateRange === '30days'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Hari
            </button>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={!data || loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0e1520] hover:bg-white/[0.06] text-slate-200 border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
            title="Ekspor laporan keuangan ke format PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI 4 Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Omset */}
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Omset Kotor</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight truncate">
              {formatIDR(summary.total_sales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Pendapatan kotor pada periode</div>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Transaksi Selesai</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              {summary.total_orders} <span className="text-xs font-sans font-normal text-slate-400">struk</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Pesanan berhasil diproses</div>
          </div>
        </div>

        {/* Card 3: Items Sold */}
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Unit Produk Terjual</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              {summary.items_sold} <span className="text-xs font-sans font-normal text-slate-400">pcs</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Kuantitas fisik keluar</div>
          </div>
        </div>

        {/* Card 4: Average Order Value */}
        <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Rata-rata Order (AOV)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight truncate">
              {formatIDR(summary.average_order_value)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Nilai per struk belanja</div>
          </div>
        </div>
      </div>

      {/* Middle Section: Cash vs Non-Cash Split */}
      <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between text-xs border-b border-white/[0.06] pb-3">
          <span className="font-bold text-white">Komposisi Metode Pembayaran Kasir</span>
          <span className="text-slate-400 font-mono">Total Omset: {formatIDR(summary.total_sales)}</span>
        </div>

        <div className="space-y-3">
          {/* Progress bar split */}
          <div className="w-full bg-[#080d15] h-2.5 rounded-full overflow-hidden flex border border-white/[0.06]">
            <div style={{ width: `${cashPct}%` }} className="bg-emerald-500 h-full transition-all duration-300" title={`Tunai ${cashPct}%`} />
            <div style={{ width: `${nonCashPct}%` }} className="bg-blue-500 h-full transition-all duration-300" title={`Non-Tunai ${nonCashPct}%`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080d15] border border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Pembayaran Tunai (Cash)</div>
                  <div className="text-sm font-bold text-white font-mono">{formatIDR(summary.cash_sales)}</div>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {cashPct}%
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#080d15] border border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                <div>
                  <div className="text-[11px] text-slate-400">Non-Tunai (QRIS / Transfer / Debit)</div>
                  <div className="text-sm font-bold text-white font-mono">{formatIDR(summary.non_cash_sales)}</div>
                </div>
              </div>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {nonCashPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Top Selling Items and Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Products */}
        <div className="lg:col-span-7 bg-[#0e1520] border border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Ranking Produk Terlaris</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Berdasarkan Volume</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {!data || data.top_products.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs font-mono">
                Belum ada data penjualan pada rentang waktu ini.
              </div>
            ) : (
              data.top_products.map((prod, index) => (
                <div key={prod.product_id} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-bold ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                      index === 2 ? 'bg-amber-700/20 text-amber-400 border border-amber-700/30' :
                      'bg-white/[0.04] text-slate-400 border border-white/10'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">{prod.product_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">Total: {prod.total_qty} unit terjual</div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-emerald-400">
                      {formatIDR(prod.total_sales)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cashier Performance */}
        <div className="lg:col-span-5 bg-[#0e1520] border border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Performa Staf Kasir</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Kontribusi Omset</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {!data || data.cashier_performance.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs font-mono">
                Belum ada aktivitas kasir pada rentang waktu ini.
              </div>
            ) : (
              data.cashier_performance.map((c, index) => (
                <div key={index} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {c.cashier_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{c.cashier_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{c.total_orders} transaksi sukses</div>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-emerald-400">
                      {formatIDR(c.total_sales)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
