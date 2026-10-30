import React, { useState } from 'react';
import {
  Store,
  ShoppingCart,
  Boxes,
  Truck,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  LayoutDashboard,
  Check
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

const roleBadges: Record<string, { label: string; bg: string; text: string; border: string }> = {
  owner: { label: 'Owner', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  branch_manager: { label: 'Manager', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  cashier: { label: 'Kasir', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  inventory_staff: { label: 'Gudang', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  isMobile = false,
  onCloseMobile,
}) => {
  const { user, currentBranch, setCurrentBranch, logout } = useAuthStore();
  const totalCartItems = useCartStore((s) => s.getTotalItems());
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const roleInfo = user?.role ? roleBadges[user.role] : null;

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    roles?: string[];
    section?: string;
  }

  const navSections = [
    {
      title: 'OPERASIONAL',
      items: [
        { id: 'pos', label: 'Kasir Penjualan', icon: ShoppingCart, badge: totalCartItems || undefined },
        { id: 'sales', label: 'Riwayat Transaksi', icon: Receipt },
      ] as NavItem[],
    },
    {
      title: 'MANAJEMEN',
      items: [
        { id: 'inventory', label: 'Inventaris & Stok', icon: Boxes },
        { id: 'suppliers', label: 'Supplier & Pasokan', icon: Truck, roles: ['owner', 'branch_manager', 'inventory_staff'] },
      ] as NavItem[],
    },
    {
      title: 'LAPORAN & ANALISIS',
      items: [
        { id: 'dashboard', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
        { id: 'reports', label: 'Laporan Penjualan', icon: BarChart3, roles: ['owner', 'branch_manager'] },
        { id: 'audit-logs', label: 'Log Audit Keamanan', icon: ShieldCheck, roles: ['owner'] },
      ] as NavItem[],
    },
    {
      title: 'SISTEM',
      items: [
        { id: 'settings', label: 'Pengaturan', icon: Settings },
      ] as NavItem[],
    },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-40 flex flex-col
        bg-[#0b1019] border-r border-white/[0.07]
        transition-all duration-200 ease-in-out select-none
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Brand Header */}
      <div className={`relative flex items-center h-14 border-b border-white/[0.07] px-3.5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                <span>{user?.business_name || 'Sentosa POS'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono tracking-wider truncate">COMMERCIAL SAAS</div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm" title={user?.business_name || 'Sentosa POS'}>
            <Store className="w-4 h-4" />
          </div>
        )}

        {isMobile ? (
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={
              collapsed
                ? "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#111927] hover:bg-emerald-600 border border-white/20 hover:border-emerald-500 text-slate-300 hover:text-white flex items-center justify-center shadow-md transition-all duration-150 z-50 cursor-pointer group"
                : "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            }
            aria-label={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
            title={collapsed ? 'Perluas navigasi' : 'Ciutkan navigasi'}
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Branch Selector */}
      {!collapsed && user && user.branches && user.branches.length > 0 && (
        <div className="px-3 py-2.5 border-b border-white/[0.07] relative">
          <button
            onClick={() => setShowBranchMenu((v) => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#070b12] hover:bg-[#111827] border border-white/[0.07] hover:border-white/15 text-xs text-slate-200 transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex-1 text-left truncate">
              <div className="text-[9px] font-mono uppercase text-slate-500 leading-tight">Cabang Aktif</div>
              <div className="font-semibold text-white truncate text-xs">
                {currentBranch ? currentBranch.name : 'Pilih Cabang'}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showBranchMenu ? 'rotate-180' : ''}`} />
          </button>

          {showBranchMenu && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-[#111827] border border-white/15 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in duration-100">
              <div className="px-2.5 py-1 text-[10px] font-mono text-slate-500 uppercase tracking-wider border-b border-white/[0.06]">
                Pindah Cabang
              </div>
              {user.branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setCurrentBranch(b); setShowBranchMenu(false); }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer ${
                    currentBranch?.id === b.id ? 'text-emerald-400 font-semibold bg-emerald-500/10' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {currentBranch?.id === b.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Branch Indicator for Collapsed Mode */}
      {collapsed && user && user.branches && user.branches.length > 0 && (
        <div className="flex justify-center py-2 border-b border-white/[0.07]">
          <div
            className="w-8 h-8 rounded-lg bg-[#070b12] border border-white/[0.07] flex items-center justify-center text-emerald-400"
            title={`Cabang Aktif: ${currentBranch?.name ?? 'Pilih Cabang'}`}
          >
            <Building2 className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
        {navSections.map((sec, idx) => {
          const visibleItems = sec.items.filter((item) => {
            if (!item.roles) return true;
            return user && item.roles.includes(user.role);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                  {sec.title}
                </div>
              )}
              {collapsed && idx > 0 && (
                <div className="my-2 border-t border-white/[0.06] mx-2" />
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                      w-full flex items-center rounded-lg transition-all cursor-pointer relative
                      ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2 text-left'}
                      ${isActive
                        ? 'bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/25 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 px-1 py-0.2 text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 rounded-full min-w-4 text-center shadow">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="text-xs truncate flex-1">{item.label}</span>
                    )}
                    {!collapsed && isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className={`border-t border-white/[0.07] p-2.5 bg-[#070b12]/60 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={() => logout()}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Keluar dari akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            {/* User Initials Avatar */}
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 font-mono">
              {user?.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.full_name}</div>
              {roleInfo && (
                <span className={`inline-block text-[9px] font-mono px-1.5 py-0.2 border rounded mt-0.5 ${roleInfo.bg} ${roleInfo.text} ${roleInfo.border}`}>
                  {roleInfo.label}
                </span>
              )}
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
              title="Keluar dari akun"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

/* Mobile Top Navigation Bar */
export const MobileTopBar: React.FC<{ onMenuClick: () => void; activeTab: string }> = ({ onMenuClick, activeTab }) => {
  const { currentBranch, user } = useAuthStore();
  const totalCartItems = useCartStore((s) => s.getTotalItems());

  const tabLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    pos: 'Kasir',
    inventory: 'Inventaris',
    suppliers: 'Supplier',
    sales: 'Transaksi',
    reports: 'Laporan',
    'audit-logs': 'Log Audit',
    settings: 'Pengaturan',
  };

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[#0b1019]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between px-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Store className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs font-bold text-white truncate">{user?.business_name || 'Sentosa POS'}</span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium px-1.5 py-0.5 border border-emerald-500/20 bg-emerald-500/10 rounded">
                {tabLabels[activeTab] ?? activeTab}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeTab === 'pos' && totalCartItems > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-md text-[11px] font-mono font-bold text-emerald-300">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{totalCartItems}</span>
          </div>
        )}

        {currentBranch && (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded-md text-[11px] text-slate-300 max-w-[130px] truncate">
            <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{currentBranch.name}</span>
          </div>
        )}
      </div>
    </header>
  );
};
