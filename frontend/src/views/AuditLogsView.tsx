import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  Filter,
  User,
  Globe,
  FileJson,
  X,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  Boxes,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Laptop,
  FileDown
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { exportAuditLogsPdf } from '../utils/pdfExport';

interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  actor_username: string;
  actor_role: string;
}

interface AuditLogStats {
  total_today: number;
  auth_2fa_count: number;
  sales_count: number;
  inventory_count: number;
}

const CATEGORIES = [
  { id: 'all', label: 'Semua Log', icon: <Filter className="w-3.5 h-3.5" /> },
  { id: 'auth', label: 'Keamanan & 2FA', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: 'sales', label: 'Penjualan', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  { id: 'inventory', label: 'Inventaris & Pasokan', icon: <Boxes className="w-3.5 h-3.5" /> },
  { id: 'users', label: 'Pengguna', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'settings', label: 'Pengaturan Toko', icon: <Settings className="w-3.5 h-3.5" /> },
];

export const AuditLogsView: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditLogStats>({
    total_today: 0,
    auth_2fa_count: 0,
    sales_count: 0,
    inventory_count: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected log for detail modal
  const [activeLog, setActiveLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        q: searchQuery,
        page: page.toString(),
        limit: limit.toString(),
      });

      const res = await apiRequest<{ logs: AuditLogItem[]; stats: AuditLogStats }>(
        `/audit-logs?${params.toString()}`
      );
      setLogs(res.logs || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Gagal memuat log audit.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, page, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const getActionBadge = (action: string) => {
    if (action.startsWith('auth.2fa.verified') || action === 'auth.login.success') {
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
      };
    }
    if (action.startsWith('auth.2fa.challenge_issued') || action.includes('unrecognized_device')) {
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }
    if (action.includes('failed') || action.includes('delete') || action.includes('expired') || action.includes('void')) {
      return {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }
    if (action.includes('create') || action.includes('sale.completed') || action.includes('restock')) {
      return {
        bg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    }
    return {
      bg: 'bg-white/[0.04] text-slate-300 border-white/10',
      icon: <Clock className="w-3.5 h-3.5" />,
    };
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">Keamanan & Kepatuhan</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Log Audit & Integritas Sistem</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Pencatatan riwayat autentikasi 2FA, transaksi kasir, mutasi stok, dan kontrol akses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0e1520] hover:bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Segarkan</span>
          </button>

          <button
            onClick={() =>
              exportAuditLogsPdf({
                logs,
                businessName: user?.business_name || 'Sentosa Retail Group',
                userName: user?.full_name || 'Administrator',
              })
            }
            disabled={logs.length === 0 || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-colors cursor-pointer disabled:opacity-40"
            title="Ekspor log audit ke PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#0e1520] border border-white/[0.07] p-4 sm:p-5 rounded-xl hover:border-white/[0.12] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Total Hari Ini</span>
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{stats.total_today}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Aktivitas sistem sejak 00:00</div>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.07] p-4 sm:p-5 rounded-xl hover:border-white/[0.12] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-amber-400">
            <span>Keamanan & 2FA</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{stats.auth_2fa_count}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Login & verifikasi tantangan OTP</div>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.07] p-4 sm:p-5 rounded-xl hover:border-white/[0.12] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-400">
            <span>Transaksi Kasir</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{stats.sales_count}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Penjualan dan pembayaran</div>
        </div>

        <div className="bg-[#0e1520] border border-white/[0.07] p-4 sm:p-5 rounded-xl hover:border-white/[0.12] transition-colors shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-blue-400">
            <span>Inventaris & Stok</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Boxes className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">{stats.inventory_count}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Mutasi stok & penerimaan barang</div>
        </div>
      </div>

      {/* Category Pills + Search */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'bg-[#0e1520] hover:bg-white/[0.06] text-slate-400 hover:text-white border border-white/[0.07]'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari berdasarkan nama aksi, pengguna, IP address, atau ID referensi..."
            className="w-full pl-10 pr-4 py-2 bg-[#0e1520] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-sans"
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
      </div>

      {/* Main Audit Table */}
      <div className="bg-[#0e1520] border border-white/[0.07] rounded-xl overflow-hidden shadow-sm">
        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#080d15]/80 border-b border-white/[0.07] text-slate-400 font-semibold">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi & Kategori</th>
                <th className="px-4 py-3">Pengguna / Aktor</th>
                <th className="px-4 py-3 hidden md:table-cell">IP & Perangkat</th>
                <th className="px-4 py-3 text-right">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400 mb-2" />
                    Memuat log audit sistem...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    Tidak ada aktivitas yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const isDeviceTrusted = log.details && log.details['trust_device'] === true;

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-sans">
                        <div className="text-xs text-slate-200 font-medium">{formatDate(log.created_at)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">ID: {log.id.slice(0, 8)}</div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${badge.bg}`}>
                            {badge.icon}
                            {log.action}
                          </span>
                          {log.entity_type && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.entity_type}: {log.entity_id || '-'}
                            </span>
                          )}
                          {isDeviceTrusted && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                              <Laptop className="w-3 h-3" />
                              Ingat: 30 Hari
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 font-mono">
                            {log.actor_name ? log.actor_name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-200">
                              {log.actor_name || 'Sistem Otomatis'}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {log.actor_username ? `@${log.actor_username}` : ''} {log.actor_role ? `• ${log.actor_role}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP & Client */}
                      <td className="px-4 py-3 hidden md:table-cell font-sans">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-mono text-[11px]">{log.ip_address || '-'}</span>
                        </div>
                        {log.user_agent && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[220px]" title={log.user_agent}>
                            {log.user_agent}
                          </div>
                        )}
                      </td>

                      {/* Details View */}
                      <td className="px-4 py-3 font-sans text-right">
                        <button
                          onClick={() => setActiveLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
                        >
                          <FileJson className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Rincian</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 bg-black/10 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400">
          <div className="font-mono">Halaman {page} (menampilkan hingga {limit} log per halaman)</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300 font-semibold">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < limit || loading}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail JSON Payload Modal */}
      {activeLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setActiveLog(null)}
        >
          <div
            className="bg-[#0e1520] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-black/20">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Rincian Log Audit Sistem
                </h3>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#080d15] p-3.5 rounded-xl border border-white/[0.06]">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Aksi</span>
                  <span className="text-emerald-400 font-mono font-bold">{activeLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Waktu Tercatat</span>
                  <span className="text-slate-300 font-medium">{formatDate(activeLog.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Aktor / Pengguna</span>
                  <span className="text-slate-200 font-medium">
                    {activeLog.actor_name} ({activeLog.actor_role || 'sistem'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">IP Address</span>
                  <span className="text-slate-200 font-mono">{activeLog.ip_address || '-'}</span>
                </div>
              </div>

              {activeLog.user_agent && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-semibold">
                    User Agent Client
                  </span>
                  <div className="p-2.5 bg-[#080d15] border border-white/[0.06] rounded-lg text-slate-300 text-[11px] break-all font-mono">
                    {activeLog.user_agent}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-semibold">
                  Metadata & Payload Rincian (JSON)
                </span>
                <pre className="p-3 bg-[#080d15] border border-white/[0.06] rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                  {JSON.stringify(activeLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/[0.07] bg-[#0e1520] flex justify-end">
              <button
                onClick={() => setActiveLog(null)}
                className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
