import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Printer, 
  X, 
  Ban, 
  AlertTriangle,
  FileDown,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { exportTransactionsListPdf } from '../utils/pdfExport';
import type { SaleDetail, SaleSummary } from '../types';

export const SalesHistoryView: React.FC = () => {
  const { currentBranch, user } = useAuthStore();
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);

  // Void confirmation dialog state
  const [voidTarget, setVoidTarget] = useState<SaleSummary | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const canVoid = user?.role === 'owner' || user?.role === 'branch_manager';

  const loadSales = async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const res = await apiRequest<{ sales: SaleSummary[] }>('/sales?limit=100');
      setSales(res.sales || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [currentBranch]);

  const filteredSales = sales.filter((sale) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [sale.receipt_number, sale.cashier_name, sale.payment_method, sale.status]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const paginatedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const viewSaleDetail = async (id: string) => {
    try {
      const res = await apiRequest<SaleDetail>(`/sales/${id}`);
      setSelectedSale(res);
    } catch (e) {
      console.error(e);
    }
  };

  const executeVoid = async () => {
    if (!voidTarget) return;
    setVoidLoading(true);
    setVoidError(null);

    try {
      await apiRequest(`/sales/${voidTarget.id}/void`, {
        method: 'POST',
      });

      setVoidTarget(null);
      loadSales();
      if (selectedSale?.id === voidTarget.id) {
        setSelectedSale(null);
      }
    } catch (err: any) {
      setVoidError(err.message || 'Gagal membatalkan transaksi');
    } finally {
      setVoidLoading(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Kasir & Penjualan</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {currentBranch && (
              <span className="text-xs text-slate-400">
                • Cabang <strong className="text-white font-medium">{currentBranch.name}</strong>
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Riwayat Transaksi Penjualan</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daftar lengkap transaksi, inspeksi struk, cetak ulang, atau pembatalan transaksi (void)
          </p>
        </div>

        <button
          onClick={() =>
            exportTransactionsListPdf({
              sales,
              branchName: currentBranch?.name,
              businessName: user?.business_name || 'Sentosa Retail Group',
              userName: user?.full_name || 'Petugas Kasir',
            })
          }
          disabled={sales.length === 0 || loading}
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0e1520] hover:bg-white/[0.06] text-slate-200 border border-white/10 transition-colors cursor-pointer disabled:opacity-40 self-start sm:self-auto"
          title="Ekspor rekap transaksi ke PDF"
        >
          <FileDown className="w-4 h-4" />
          <span>Export Rekap PDF</span>
        </button>
      </div>

      {/* Main Register Table Panel */}
      <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-3.5 border-b border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/10">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }}
              placeholder="Cari nomor struk, nama kasir, metode pembayaran..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#080d15] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-sans"
              aria-label="Cari transaksi"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 font-mono self-end sm:self-auto">
            Total: <span className="font-semibold text-slate-200">{filteredSales.length} Transaksi</span>
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080d15]/80 text-slate-400 font-semibold border-b border-white/[0.07]">
              <tr>
                <th className="px-4 py-3">No. Struk</th>
                <th className="px-4 py-3">Waktu Transaksi</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3 text-center">Metode Bayar</th>
                <th className="px-4 py-3 text-right">Total Transaksi</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-mono">
                    Memuat daftar transaksi...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-sans">
                    Tidak ada transaksi yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      {s.receipt_number}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px] font-sans">
                      {new Date(s.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-200">
                      {s.cashier_name}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className="inline-block uppercase px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono font-medium text-slate-300 border border-white/10">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400 text-sm">
                      {formatIDR(s.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      {s.status === 'completed' ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Selesai
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          Void
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => viewSaleDetail(s.id)}
                          className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 transition-colors inline-flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Struk</span>
                        </button>
                        {canVoid && s.status === 'completed' && (
                          <button
                            onClick={() => setVoidTarget(s)}
                            className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                            title="Batalkan Transaksi (Void)"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400 bg-black/10">
          <span className="font-mono">Menampilkan {paginatedSales.length} dari {filteredSales.length} transaksi</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 font-semibold">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sale Detail & Printable Thermal Receipt Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-sm max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-3.5 border-b border-white/[0.07] flex items-center justify-between shrink-0 bg-black/20">
              <span className="font-bold text-white text-sm">Struk Transaksi Penjualan</span>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 bg-[#080d15] flex justify-center overflow-y-auto flex-1">
              <div
                id="printable-receipt"
                className="bg-white text-slate-950 font-mono text-[11px] p-5 w-72 rounded-lg shadow-md border border-slate-300"
              >
                <div className="text-center pb-3 border-b border-dashed border-slate-400">
                  <div className="font-bold text-sm tracking-wide">{user?.business_name || 'SENTOSA RETAIL GROUP'}</div>
                  <div className="text-[10px] text-slate-700">{selectedSale.branch_name}</div>
                  <div className="text-[10px] text-slate-600 mt-1">
                    {selectedSale.status === 'voided' ? '*** STRUK DIBATALKAN (VOID) ***' : 'Struk Resmi Penjualan'}
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>No. Struk:</span>
                    <span className="font-bold">{selectedSale.receipt_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tanggal:</span>
                    <span>{new Date(selectedSale.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{selectedSale.cashier_name}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-2">
                  {selectedSale.lines.map((line, idx) => (
                    <div key={idx}>
                      <div className="font-semibold text-slate-900">{line.product_name}</div>
                      <div className="flex justify-between text-slate-700">
                        <span>
                          {line.quantity} x {formatIDR(line.unit_price)}
                        </span>
                        <span>{formatIDR(line.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-slate-800">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatIDR(selectedSale.subtotal)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                    <span>TOTAL</span>
                    <span>{formatIDR(selectedSale.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-1">
                    <span>Bayar ({selectedSale.payment_method.toUpperCase()})</span>
                    <span>{formatIDR(selectedSale.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Kembalian</span>
                    <span>{formatIDR(selectedSale.change_due)}</span>
                  </div>
                </div>

                <div className="text-center pt-3 text-[10px] text-slate-600">
                  Terima kasih atas kunjungan Anda!<br />
                  Barang yang sudah dibeli tidak dapat ditukar.
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-white/[0.07] bg-[#0e1520] flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Cetak Ulang</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1520] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">Batalkan Transaksi (Void)?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Transaksi <span className="font-mono font-bold text-white">{voidTarget.receipt_number}</span> senilai{' '}
                <span className="font-bold text-emerald-400">{formatIDR(voidTarget.total_amount)}</span> akan dibatalkan secara permanen.
                Stok barang akan secara otomatis dikembalikan ke gudang cabang.
              </p>
            </div>

            {voidError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs text-center">
                {voidError}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-white/[0.07]">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Jangan Batalkan
              </button>
              <button
                type="button"
                disabled={voidLoading}
                onClick={executeVoid}
                className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
              >
                {voidLoading ? 'Membatalkan...' : 'Ya, Batalkan Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
