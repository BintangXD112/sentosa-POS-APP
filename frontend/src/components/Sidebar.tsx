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

const roleLabels: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  branch_manager: { label: 'Manager', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  cashier: { label: 'Kasir', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  inventory_staff: { label: 'Gudang', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
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

  const currentRole = user ? (roleLabels[user.role] ?? { label: 'Staff', color: 'bg-white/[0.08] text-slate-300 border-white/[0.12]' }) : null;

  type NavItem = {
    id: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    roles?: string[];
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'pos', label: 'POS Kasir', icon: <ShoppingCart className="w-5 h-5" />, badge: totalCartItems || undefined },
    { id: 'inventory', label: 'Inventaris', icon: <Boxes className="w-5 h-5" /> },
    { id: 'suppliers', label: 'Supplier & Pasokan', icon: <Truck className="w-5 h-5" />, roles: ['owner', 'branch_manager', 'inventory_staff'] },
    { id: 'sales', label: 'Riwayat Transaksi', icon: <Receipt className="w-5 h-5" /> },
    { id: 'reports', label: 'Laporan', icon: <BarChart3 className="w-5 h-5" />, roles: ['owner', 'branch_manager'] },
    { id: 'audit-logs', label: 'Log Audit', icon: <ShieldCheck className="w-5 h-5" />, roles: ['owner'] },
    { id: 'settings', label: 'Pengaturan', icon: <Settings className="w-5 h-5" /> },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  return (
    <aside
      className={`
        fixed left-0 top-0 h-full z-40 flex flex-col
        bg-[#0e1520] border-r border-white/[0.08]
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}
    >
      {/* Logo + Collapse toggle */}
      <div className={`relative flex items-center h-15 border-b border-white/[0.08] px-3.5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white tracking-tight truncate">{user?.business_name || 'Sentosa POS'}</div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wide truncate">RETAIL SYSTEM</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
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
                ? "absolute -right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#141c2c] hover:bg-emerald-600 border border-white/20 hover:border-emerald-500 text-slate-300 hover:text-white flex items-center justify-center shadow-md transition-all duration-200 z-50 cursor-pointer group"
                : "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            }
            aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
            title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
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
      {!collapsed && user && user.branches.length > 0 && (
        <div className="px-3 py-2.5 border-b border-white/[0.08] relative">
          <button
            onClick={() => setShowBranchMenu((v) => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#090d14] hover:bg-[#111927] border border-white/[0.08] hover:border-white/20 text-xs text-slate-200 transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-medium flex-1 truncate text-left text-xs">
              {currentBranch ? currentBranch.name : 'Pilih Cabang'}
            </span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showBranchMenu ? 'rotate-180' : ''}`} />
          </button>
          {showBranchMenu && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-[#141c2c] border border-white/15 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              {user.branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setCurrentBranch(b); setShowBranchMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer ${
                    currentBranch?.id === b.id ? 'text-emerald-400 font-semibold bg-white/[0.05]' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {currentBranch?.id === b.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Branch icon (collapsed) */}
      {collapsed && user && user.branches.length > 0 && (
        <div className="flex justify-center py-2.5 border-b border-white/[0.08]">
          <div className="w-7 h-7 rounded-md bg-[#090d14] border border-white/[0.08] flex items-center justify-center" title={currentBranch?.name ?? 'Cabang'}>
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 py-2.5 space-y-0.5 px-2 overflow-y-auto">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              w-full flex items-center rounded-lg transition-all cursor-pointer
              ${collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'}
              ${activeTab === item.id
                ? 'bg-white/[0.08] text-white font-semibold border-l-2 border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
            title={collapsed ? item.label : undefined}
          >
            <div className="flex-shrink-0 relative">
              {item.icon}
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 text-[9px] font-mono font-bold bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center shadow">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            {!collapsed && (
              <span className="text-xs truncate">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom: User info + logout */}
      <div className={`border-t border-white/[0.08] p-3 bg-black/10 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={() => logout()}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* Avatar */}
            <div className="w-7 h-7 rounded-md bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 flex-shrink-0 font-mono">
              {user?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.full_name}</div>
              {currentRole && (
                <span className={`inline-block text-[9px] font-mono px-1 py-0.2 border rounded mt-0.5 ${currentRole.color}`}>
                  {currentRole.label}
                </span>
              )}
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0 cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

/* Mobile top bar (hamburger) for small screens */
export const MobileTopBar: React.FC<{ onMenuClick: () => void; activeTab: string }> = ({ onMenuClick, activeTab }) => {
  const { currentBranch, user } = useAuthStore();

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
    <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-13 bg-[#0e1520]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between px-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onMenuClick}
          className="p-1.5 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Store className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs font-bold text-white truncate">Sentosa</span>
              <span className="text-[10px] text-emerald-400 font-mono font-medium px-1.5 py-0.2 border border-emerald-500/20 bg-emerald-500/10 rounded">
                {tabLabels[activeTab] ?? activeTab}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {currentBranch && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded text-[11px] text-slate-300 max-w-[120px] truncate">
            <Building2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{currentBranch.name}</span>
          </div>
        )}

        {user && (
          <div className="w-6 h-6 rounded bg-white/[0.08] border border-white/10 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400">
            {user.full_name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
};
