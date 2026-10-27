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

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Laporan & Analitik Penjualan</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ringkasan omset dan performa kasir di {currentBranch?.name}
          </p>
        </div>

        {/* Controls: Date Presets & Export PDF */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Preset Buttons */}
          <div className="flex items-center gap-1 bg-[#0e1520] border border-white/[0.08] p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => setDateRange('today')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-center cursor-pointer ${
                dateRange === 'today'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setDateRange('7days')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-center cursor-pointer ${
                dateRange === '7days'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDateRange('30days')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-center cursor-pointer ${
                dateRange === '30days'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Hari
            </button>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={!data || loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            title="Ekspor laporan ini ke format PDF siap cetak"
          >
            <FileDown className="w-4 h-4" />
            <span>Export ke PDF</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Cards (2 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Omset</span>
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight truncate">
              {formatIDR(summary.total_sales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">Pendapatan kotor periode</div>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Transaksi Selesai</span>
            <div className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              {summary.total_orders} <span className="text-xs font-sans font-normal text-slate-400">Struk</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">Transaksi sukses</div>
          </div>
        </div>

        {/* Card 3: Items Sold */}
        <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Item Terjual</span>
            <div className="p-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight">
              {summary.items_sold} <span className="text-xs font-sans font-normal text-slate-400">Pcs</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">Kuantitas produk keluar</div>
          </div>
        </div>

        {/* Card 4: Average Order Value */}
        <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Rata-rata (AOV)</span>
            <div className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-white font-mono tracking-tight truncate">
              {formatIDR(summary.average_order_value)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">Rata-rata per struk</div>
          </div>
        </div>
      </div>

      {/* Middle Section: Cash vs Non-Cash Split */}
      <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white">Distribusi Metode Pembayaran</span>
          <span className="text-slate-400 font-mono">Total: {formatIDR(summary.total_sales)}</span>
        </div>

        {/* Progress bar */}
        {(() => {
          const cashPct = summary.total_sales > 0 ? Math.round((summary.cash_sales / summary.total_sales) * 100) : 50;
          const nonCashPct = summary.total_sales > 0 ? 100 - cashPct : 50;
          return (
            <div className="space-y-3">
              <div className="w-full bg-[#090d14] h-2.5 rounded-full overflow-hidden flex border border-white/[0.06]">
                <div style={{ width: `${cashPct}%` }} className="bg-emerald-500 h-full transition-all duration-500" title={`Tunai ${cashPct}%`} />
                <div style={{ width: `${nonCashPct}%` }} className="bg-blue-500 h-full transition-all duration-500" title={`Non-Tunai ${nonCashPct}%`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#090d14] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400">Tunai (Cash)</div>
                      <div className="text-sm font-bold text-white font-mono">{formatIDR(summary.cash_sales)}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {cashPct}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#090d14] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <div>
                      <div className="text-[11px] text-slate-400">Non-Tunai (QRIS / Transfer)</div>
                      <div className="text-sm font-bold text-white font-mono">{formatIDR(summary.non_cash_sales)}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {nonCashPct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Section: Top Products & Cashier Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top 5 Best Selling Products (7 cols) */}
        <div className="lg:col-span-7 bg-[#0e1520] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Produk Terlaris</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Paling Banyak Terjual</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {!data || data.top_products.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                Belum ada data penjualan pada rentang waktu ini.
              </div>
            ) : (
              data.top_products.map((prod, index) => (
                <div key={prod.product_id} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                      index === 2 ? 'bg-amber-700/20 text-amber-400 border border-amber-700/30' :
                      'bg-white/[0.04] text-slate-400 border border-white/10'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-xs font-medium text-white">{prod.product_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Terjual: {prod.total_qty} unit</div>
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

        {/* Cashier Performance (5 cols) */}
        <div className="lg:col-span-5 bg-[#0e1520] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between bg-black/10">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Performa Kasir</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Aktivitas Petugas</span>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {!data || data.cashier_performance.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                Belum ada aktivitas kasir pada rentang waktu ini.
              </div>
            ) : (
              data.cashier_performance.map((c, index) => (
                <div key={index} className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="text-xs font-medium text-white">{c.cashier_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{c.total_orders} transaksi selesai</div>
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
