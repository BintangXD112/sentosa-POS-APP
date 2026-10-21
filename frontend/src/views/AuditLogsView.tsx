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
  { id: 'all', label: 'Semua Log', icon: <Filter className="w-4 h-4" /> },
  { id: 'auth', label: 'Keamanan & 2FA', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'sales', label: 'Penjualan', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventaris & Supplier', icon: <Boxes className="w-4 h-4" /> },
  { id: 'users', label: 'Pengguna', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Pengaturan', icon: <Settings className="w-4 h-4" /> },
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

  // Format date helper
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

  // Action badge color helper
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
    if (action.includes('failed') || action.includes('delete') || action.includes('expired')) {
      return {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    }
    if (action.includes('create') || action.includes('sale.completed')) {
      return {
        bg: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    }
    if (action.includes('update') || action.includes('edit')) {
      return {
        bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        icon: <Clock className="w-3.5 h-3.5" />,
      };
    }
    return {
      bg: 'bg-slate-700/50 text-slate-300 border-slate-600',
      icon: <Clock className="w-3.5 h-3.5" />,
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Log Audit & Keamanan Sistem
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Pencatatan riwayat login 2FA, verifikasi perangkat terpercaya 30 hari, transaksi, dan aktivitas sistem
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Segarkan Data
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
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Ekspor log audit ke format PDF siap cetak"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400">Total Hari Ini</div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.total_today}</div>
          <div className="text-[11px] text-slate-500 mt-1">Aktivitas tercatat sejak 00:00</div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center text-slate-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="text-xs font-medium text-amber-400">Keamanan & 2FA</div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.auth_2fa_count}</div>
          <div className="text-[11px] text-slate-500 mt-1">Percobaan login & verifikasi OTP</div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="text-xs font-medium text-emerald-400">Transaksi Kasir</div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.sales_count}</div>
          <div className="text-[11px] text-slate-500 mt-1">Penjualan dan pembayaran</div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShoppingCart className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
          <div className="text-xs font-medium text-blue-400">Inventaris & Stok</div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats.inventory_count}</div>
          <div className="text-[11px] text-slate-500 mt-1">Mutasi barang & pesanan supplier</div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Boxes className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Tabs + Search bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari berdasarkan aksi, nama pengguna, IP address, atau ID referensi..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all"
          />
        </div>
      </div>

      {/* Main Table / List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi & Kategori</th>
                <th className="px-4 py-3">Pelaku / Pengguna</th>
                <th className="px-4 py-3 hidden md:table-cell">IP & Perangkat</th>
                <th className="px-4 py-3">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
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
                  const isDeviceTrusted =
                    log.details &&
                    log.details['trust_device'] === true;

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400 font-sans">
                        <div className="text-xs text-slate-200 font-medium">{formatDate(log.created_at)}</div>
                        <div className="text-[10px] text-slate-500">ID: {log.id.slice(0, 8)}</div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badge.bg}`}
                          >
                            {badge.icon}
                            {log.action}
                          </span>
                          {log.entity_type && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.entity_type}: {log.entity_id || '-'}
                            </span>
                          )}
                          {isDeviceTrusted && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <Laptop className="w-3 h-3" />
                              Ingat Perangkat: 30 Hari
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {log.actor_name ? log.actor_name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-200">
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
                          <Globe className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="font-mono text-[11px]">{log.ip_address || '-'}</span>
                        </div>
                        {log.user_agent && (
                          <div
                            className="text-[10px] text-slate-500 truncate max-w-[220px]"
                            title={log.user_agent}
                          >
                            {log.user_agent}
                          </div>
                        )}
                      </td>

                      {/* Details View */}
                      <td className="px-4 py-3 font-sans whitespace-nowrap">
                        <button
                          onClick={() => setActiveLog(log)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 hover:text-white transition-all cursor-pointer"
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

        {/* Pagination bar */}
        <div className="p-3 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>Halaman {page} (menampilkan hingga {limit} log per halaman)</div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-slate-300">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < limit || loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Log */}
      {activeLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setActiveLog(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Rincian Log Audit
                </h3>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Aksi</span>
                  <span className="text-emerald-400 font-mono font-medium">{activeLog.action}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Waktu Tercatat</span>
                  <span className="text-slate-300 font-medium">{formatDate(activeLog.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Pelaku</span>
                  <span className="text-slate-300 font-medium">
                    {activeLog.actor_name} ({activeLog.actor_role || 'sistem'})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">IP Address</span>
                  <span className="text-slate-300 font-mono">{activeLog.ip_address || '-'}</span>
                </div>
              </div>

              {activeLog.user_agent && (
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                    User Agent Client
                  </span>
                  <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 text-[11px] break-all font-mono">
                    {activeLog.user_agent}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                  Metadata & Rincian Payload (JSON)
                </span>
                <pre className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                  {JSON.stringify(activeLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/30 flex justify-end">
              <button
                onClick={() => setActiveLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
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
