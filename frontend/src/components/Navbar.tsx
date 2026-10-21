import React from 'react';
import { 
  Store, 
  ShoppingCart, 
  Boxes, 
  Receipt, 
  BarChart3, 
  LogOut, 
  Building2, 
  ChevronDown 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, currentBranch, setCurrentBranch, logout } = useAuthStore();
  const totalCartItems = useCartStore((state) => state.getTotalItems());
  const [showBranchMenu, setShowBranchMenu] = React.useState(false);

  const roleLabels: Record<string, { label: string; color: string }> = {
    owner: { label: 'Owner', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    branch_manager: { label: 'Manager', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    cashier: { label: 'Kasir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    inventory_staff: { label: 'Gudang', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  };

  const currentRole = user ? roleLabels[user.role] : { label: 'Staff', color: 'bg-slate-700 text-slate-300' };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Store className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Sentosa POS</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Sistem Kasir & Multi-Cabang</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pos'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>POS Kasir</span>
              {totalCartItems > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-white text-emerald-900 rounded-full">
                  {totalCartItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Inventaris</span>
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'sales'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Riwayat Transaksi</span>
            </button>

            {(user?.role === 'owner' || user?.role === 'branch_manager') && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'reports'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Laporan</span>
              </button>
            )}
          </nav>

          {/* Right Header Area: Branch switcher & User */}
          <div className="flex items-center gap-3">
            {/* Branch Selector */}
            {user && user.branches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBranchMenu(!showBranchMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium max-w-[140px] truncate">
                    {currentBranch ? currentBranch.name : 'Pilih Cabang'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showBranchMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                      Ganti Lokasi Cabang
                    </div>
                    {user.branches.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setCurrentBranch(b);
                          setShowBranchMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${
                          currentBranch?.id === b.id ? 'bg-slate-700/60 text-emerald-400 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {currentBranch?.id === b.id && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">{user?.full_name}</div>
                <div className="flex justify-end">
                  <span className={`text-[10px] font-medium px-2 py-0.2 border rounded-full ${currentRole.color}`}>
                    {currentRole.label}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                title="Keluar"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
