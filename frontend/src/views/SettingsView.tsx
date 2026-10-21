import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Bell,
  Palette,
  Globe,
  Shield,
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Info,
  Store,
  Building2,
  Phone,
  MapPin,
  FileText,
  Save,
  RotateCcw,
  Edit2,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, type AccentColor } from '../store/themeStore';
import { apiRequest } from '../api/client';
import type { Branch } from '../types';

const roleLabels: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  branch_manager: { label: 'Branch Manager', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  cashier: { label: 'Kasir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  inventory_staff: { label: 'Staf Gudang', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

type Section = 'profile' | 'store' | 'security' | 'notifications' | 'appearance' | 'about';

export const SettingsView: React.FC = () => {
  const { user, currentBranch, setCurrentBranch, updateUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState<Section>('profile');

  // --- Profile state ---
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync profile form when user store changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // --- Store & Business state (Owner only) ---
  const isOwner = user?.role === 'owner';
  const [bizLoading, setBizLoading] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);
  const [bizMessage, setBizMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [bizName, setBizName] = useState(user?.business_name || '');
  const [bizCurrency, setBizCurrency] = useState('IDR');
  const [bizPhone, setBizPhone] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizReceiptFooter, setBizReceiptFooter] = useState('');
  const [branchesList, setBranchesList] = useState<Branch[]>([]);

  // Branch editing state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchMessage, setBranchMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBusinessData = async () => {
    if (!isOwner) return;
    setBizLoading(true);
    try {
      const data = await apiRequest<{
        business: {
          id: string;
          name: string;
          currency: string;
          phone: string;
          address: string;
          receipt_footer: string;
        };
        branches: Branch[];
      }>('/business');

      if (data.business) {
        setBizName(data.business.name || '');
        setBizCurrency(data.business.currency || 'IDR');
        setBizPhone(data.business.phone || '');
        setBizAddress(data.business.address || '');
        setBizReceiptFooter(data.business.receipt_footer || '');
      }
      if (data.branches) {
        setBranchesList(data.branches);
      }
    } catch (err: any) {
      console.error('Failed to load business details:', err);
    } finally {
      setBizLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'store' && isOwner) {
      fetchBusinessData();
    }
  }, [activeSection, isOwner]);

  // --- Password change state ---
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Notification prefs state (UI only) ---
  const [notifSound, setNotifSound] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  // --- Appearance state (Global reactive theme) ---
  const { accentColor, setAccentColor, compactMode, setCompactMode } = useThemeStore();

  const currentRole = user ? (roleLabels[user.role] ?? { label: 'Staff', color: 'bg-slate-700 text-slate-300' }) : null;

  const passStrength = (() => {
    if (newPass.length === 0) return 0;
    let s = 0;
    if (newPass.length >= 8) s++;
    if (/[A-Z]/.test(newPass)) s++;
    if (/[0-9]/.test(newPass)) s++;
    if (/[^A-Za-z0-9]/.test(newPass)) s++;
    return s;
  })();
  const passStrengthLabel = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'][passStrength];
  const passStrengthColor = ['', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-400'][passStrength];

  // --- Handlers ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    if (!fullName.trim()) {
      setProfileMessage({ type: 'error', text: 'Nama lengkap tidak boleh kosong.' });
      return;
    }
    if (username.trim().length < 3) {
      setProfileMessage({ type: 'error', text: 'Username minimal 3 karakter.' });
      return;
    }

    setProfileLoading(true);
    try {
      const res = await apiRequest<{ message: string; token: string; user: any }>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
        }),
      });

      if (res.user) {
        updateUser(res.user, res.token);
      }
      setProfileMessage({ type: 'success', text: 'Profil Anda berhasil diperbarui!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Gagal memperbarui profil.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResetProfile = () => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setProfileMessage(null);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBizMessage(null);

    if (!bizName.trim()) {
      setBizMessage({ type: 'error', text: 'Nama toko/bisnis tidak boleh kosong.' });
      return;
    }

    setBizSaving(true);
    try {
      const res = await apiRequest<{ message: string; business: any }>('/business', {
        method: 'PUT',
        body: JSON.stringify({
          name: bizName.trim(),
          currency: bizCurrency.trim() || 'IDR',
          phone: bizPhone.trim(),
          address: bizAddress.trim(),
          receipt_footer: bizReceiptFooter.trim(),
        }),
      });

      setBizMessage({ type: 'success', text: res.message || 'Pengaturan toko berhasil disimpan!' });

      // Update current user's business name in store
      if (user) {
        updateUser({
          ...user,
          business_name: bizName.trim(),
        });
      }
    } catch (err: any) {
      setBizMessage({ type: 'error', text: err.message || 'Gagal menyimpan pengaturan toko.' });
    } finally {
      setBizSaving(false);
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setBranchMessage(null);

    if (!editingBranch.name.trim()) {
      setBranchMessage({ type: 'error', text: 'Nama cabang tidak boleh kosong.' });
      return;
    }

    setBranchSaving(true);
    try {
      const res = await apiRequest<{ message: string; branch: Branch }>(`/branches/${editingBranch.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingBranch.name.trim(),
          address: editingBranch.address.trim(),
          phone: editingBranch.phone.trim(),
          is_active: editingBranch.is_active,
        }),
      });

      setBranchesList((prev) =>
        prev.map((b) => (b.id === editingBranch.id ? { ...b, ...editingBranch } : b))
      );

      // If updating currently active branch, sync store
      if (currentBranch?.id === editingBranch.id) {
        setCurrentBranch({ ...currentBranch, ...editingBranch });
      }

      setBranchMessage({ type: 'success', text: res.message || 'Data cabang berhasil diperbarui!' });
      setTimeout(() => {
        setEditingBranch(null);
        setBranchMessage(null);
      }, 1200);
    } catch (err: any) {
      setBranchMessage({ type: 'error', text: err.message || 'Gagal memperbarui cabang.' });
    } finally {
      setBranchSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMessage(null);
    if (newPass.length < 8) {
      setPassMessage({ type: 'error', text: 'Password baru minimal 8 karakter.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMessage({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }
    setPassLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
      });
      setPassMessage({ type: 'success', text: 'Password berhasil diperbarui.' });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err.message || 'Gagal memperbarui password.' });
    } finally {
      setPassLoading(false);
    }
  };

  // Nav Sections
  const sections: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'profile', label: 'Profil Saya', icon: <User className="w-4 h-4" /> },
    ...(isOwner
      ? [
          {
            id: 'store' as Section,
            label: 'Pengaturan Toko',
            icon: <Store className="w-4 h-4" />,
            badge: 'Owner',
          },
        ]
      : []),
    { id: 'security', label: 'Keamanan', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifikasi', icon: <Bell className="w-4 h-4" /> },
    { id: 'appearance', label: 'Tampilan', icon: <Palette className="w-4 h-4" /> },
    { id: 'about', label: 'Tentang Aplikasi', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-white">Pengaturan</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Kelola profil pengguna, preferensi aplikasi, dan konfigurasi toko
        </p>
      </div>

      {/* Mobile Horizontal Section Tabs */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all active:scale-95 ${
              activeSection === s.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {s.icon}
            <span>{s.label}</span>
            {s.badge && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                {s.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        {/* Desktop Left Nav */}
        <aside className="hidden md:block md:col-span-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden sticky top-6">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-slate-800 last:border-0 ${
                  activeSection === s.id
                    ? 'bg-emerald-600/10 text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {s.icon}
                  <span>{s.label}</span>
                  {s.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 font-medium">
                      {s.badge}
                    </span>
                  )}
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-opacity ${
                    activeSection === s.id ? 'opacity-100 text-emerald-400' : 'opacity-0'
                  }`}
                />
              </button>
            ))}
          </div>
        </aside>

        {/* Right Content */}
        <div className="md:col-span-9 space-y-6">
          {/* PROFILE SECTION (EDITABLE) */}
          {activeSection === 'profile' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Profil Pengguna</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Perbarui data identitas nama, username, dan email akun Anda
                  </p>
                </div>
                {currentRole && (
                  <span className={`text-xs font-semibold px-2.5 py-1 border rounded-full ${currentRole.color}`}>
                    {currentRole.label}
                  </span>
                )}
              </div>

              {/* Status Message */}
              {profileMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                    profileMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                  }`}
                >
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              {/* Avatar + Quick summary */}
              <div className="flex items-center gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
                  {fullName ? fullName.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-white truncate">{fullName || user?.full_name}</div>
                  <div className="text-xs text-slate-400 font-mono">@{username || user?.username}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cabang Aktif: <strong className="text-slate-300">{currentBranch?.name ?? 'Semua Cabang'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Edit Form */}
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-full-name">
                      Nama Lengkap <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="input-full-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                      className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-username">
                      Username <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                      <input
                        id="input-username"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        placeholder="username"
                        className="w-full pl-8 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-email">
                      Email
                    </label>
                    <input
                      id="input-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@contoh.com"
                      className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Peran / Hak Akses
                    </label>
                    <div className="px-3.5 py-2.5 bg-slate-800/40 border border-slate-700/60 rounded-xl text-sm text-slate-400 flex items-center justify-between">
                      <span className="capitalize">{currentRole?.label || user?.role}</span>
                      <Shield className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>{profileLoading ? 'Menyimpan...' : 'Simpan Profil'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetProfile}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STORE & BUSINESS SETTINGS (OWNER ONLY) */}
          {activeSection === 'store' && isOwner && (
            <div className="space-y-6">
              {/* Business Info Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Store className="w-5 h-5 text-emerald-400" />
                      <span>Pengaturan Toko & Bisnis</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Khusus Owner: Atur nama toko, mata uang, alamat pusat, dan format struk
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    Akses Khusus Owner
                  </span>
                </div>

                {bizMessage && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                      bizMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                    }`}
                  >
                    {bizMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{bizMessage.text}</span>
                  </div>
                )}

                {bizLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Memuat data toko...</div>
                ) : (
                  <form onSubmit={handleSaveBusiness} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-biz-name">
                          Nama Toko / Bisnis <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <Store className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="input-biz-name"
                            type="text"
                            required
                            value={bizName}
                            onChange={(e) => setBizName(e.target.value)}
                            placeholder="Contoh: Sentosa Retail Group"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-biz-currency">
                          Mata Uang
                        </label>
                        <div className="relative">
                          <Coins className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <select
                            id="input-biz-currency"
                            value={bizCurrency}
                            onChange={(e) => setBizCurrency(e.target.value)}
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                          >
                            <option value="IDR">IDR (Rupiah Indonesia - Rp)</option>
                            <option value="USD">USD (US Dollar - $)</option>
                            <option value="SGD">SGD (Singapore Dollar - S$)</option>
                            <option value="MYR">MYR (Malaysian Ringgit - RM)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-biz-phone">
                          Nomor Telepon Toko
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            id="input-biz-phone"
                            type="text"
                            value={bizPhone}
                            onChange={(e) => setBizPhone(e.target.value)}
                            placeholder="Contoh: 021-5551234 atau 08123456789"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-biz-address">
                          Alamat Kantor Pusat / Toko Utama
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                          <textarea
                            id="input-biz-address"
                            rows={2}
                            value={bizAddress}
                            onChange={(e) => setBizAddress(e.target.value)}
                            placeholder="Alamat lengkap lokasi toko pusat"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-biz-receipt">
                          Pesan Kaki Struk (Receipt Footer)
                        </label>
                        <div className="relative">
                          <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                          <textarea
                            id="input-biz-receipt"
                            rows={2}
                            value={bizReceiptFooter}
                            onChange={(e) => setBizReceiptFooter(e.target.value)}
                            placeholder="Contoh: Terima kasih atas kunjungan Anda! Barang yang sudah dibeli tidak dapat ditukar."
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={bizSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>{bizSaving ? 'Menyimpan Pengaturan...' : 'Simpan Pengaturan Toko'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Branches Management */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span>Daftar Cabang / Outlet Toko</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kelola nama, alamat, dan nomor telepon setiap cabang yang terdaftar
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">Total: {branchesList.length} Cabang</span>
                </div>

                {editingBranch && (
                  <form
                    onSubmit={handleSaveBranch}
                    className="bg-slate-800/70 border border-emerald-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                        Edit Data Cabang: {editingBranch.name}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingBranch(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Tutup
                      </button>
                    </div>

                    {branchMessage && (
                      <div
                        className={`p-2.5 rounded-lg text-xs ${
                          branchMessage.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {branchMessage.text}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nama Cabang</label>
                        <input
                          type="text"
                          required
                          value={editingBranch.name}
                          onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Telepon Cabang</label>
                        <input
                          type="text"
                          value={editingBranch.phone}
                          onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Alamat Cabang</label>
                        <input
                          type="text"
                          value={editingBranch.address}
                          onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <input
                          id="branch-active-check"
                          type="checkbox"
                          checked={editingBranch.is_active}
                          onChange={(e) => setEditingBranch({ ...editingBranch, is_active: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                        />
                        <label htmlFor="branch-active-check" className="text-xs text-slate-300 cursor-pointer">
                          Cabang aktif beroperasi
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={branchSaving}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        {branchSaving ? 'Menyimpan...' : 'Simpan Cabang'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBranch(null)}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {branchesList.map((branch) => (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between p-3.5 bg-slate-800/40 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{branch.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              branch.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {branch.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                          {branch.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {branch.address}
                            </span>
                          )}
                          {branch.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {branch.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingBranch(branch);
                          setBranchMessage(null);
                        }}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                        title="Edit Cabang"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECURITY SECTION */}
          {activeSection === 'security' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div>
                <h2 className="text-sm font-bold text-white">Ubah Password</h2>
                <p className="text-xs text-slate-400 mt-1">Gunakan password yang kuat dan unik.</p>
              </div>

              {passMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    passMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/25 text-rose-400'
                  }`}
                >
                  {passMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Shield className="w-4 h-4 flex-shrink-0" />
                  )}
                  {passMessage.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="settings-current-pass">
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-current-pass"
                      type={showCurrent ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Password sekarang"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="settings-new-pass">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="settings-new-pass"
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPass.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all ${
                              i <= passStrength ? passStrengthColor : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-[11px] font-medium ${passStrengthColor.replace('bg-', 'text-')}`}>
                        {passStrengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="settings-confirm-pass">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    id="settings-confirm-pass"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Ulangi password baru"
                    className={`w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      confirmPass && newPass !== confirmPass
                        ? 'border-rose-500'
                        : confirmPass && newPass === confirmPass
                        ? 'border-emerald-500'
                        : 'border-slate-700 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  {passLoading ? 'Menyimpan...' : 'Perbarui Password'}
                </button>
              </form>

              {/* Security Info */}
              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 mb-3">Rekomendasi Keamanan</h3>
                <div className="space-y-2">
                  {[
                    'Gunakan password minimal 12 karakter dengan kombinasi huruf, angka, dan simbol.',
                    'Jangan gunakan password yang sama di banyak layanan.',
                    'Logout setelah selesai menggunakan perangkat publik.',
                    'Token sesi akan kadaluwarsa secara otomatis setelah periode tidak aktif.',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-white">Preferensi Notifikasi</h2>
              <div className="space-y-4">
                {[
                  {
                    id: 'sound',
                    label: 'Suara Notifikasi',
                    desc: 'Putar suara saat ada transaksi baru masuk',
                    value: notifSound,
                    set: setNotifSound,
                  },
                  {
                    id: 'email',
                    label: 'Notifikasi Email',
                    desc: 'Terima ringkasan harian via email',
                    value: notifEmail,
                    set: setNotifEmail,
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      onClick={() => item.set(!item.value)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        item.value ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          item.value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">Pengaturan notifikasi hanya berlaku untuk sesi ini.</p>
            </div>
          )}

          {/* APPEARANCE */}
          {activeSection === 'appearance' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-white">Tampilan</h2>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-3">Warna Aksen</label>
                <div className="flex gap-3">
                  {[
                    { id: 'emerald', bgClass: 'bg-[#10b981]', label: 'Hijau Emerald' },
                    { id: 'blue', bgClass: 'bg-[#3b82f6]', label: 'Biru' },
                    { id: 'violet', bgClass: 'bg-[#8b5cf6]', label: 'Ungu' },
                    { id: 'amber', bgClass: 'bg-[#f59e0b]', label: 'Kuning' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setAccentColor(c.id as AccentColor)}
                      className={`w-10 h-10 rounded-xl ${c.bgClass} transition-all cursor-pointer ${
                        accentColor === c.id
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Mode Kompak</div>
                  <div className="text-xs text-slate-400 mt-0.5">Kurangi spasi untuk menampilkan lebih banyak konten</div>
                </div>
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    compactMode ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      compactMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-500">Pengaturan tampilan otomatis tersimpan di peramban ini.</p>
            </div>
          )}

          {/* ABOUT */}
          {activeSection === 'about' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Globe className="w-8 h-8 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{user?.business_name || 'Sentosa POS'}</h2>
                  <p className="text-sm text-slate-400">Multi-Branch Point of Sale System</p>
                  <span className="mt-1 inline-block text-xs font-semibold px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full">
                    v1.0.0
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Versi Aplikasi', value: '1.0.0 (Build 2026.10)' },
                  { label: 'Backend', value: 'Go + Fiber v2' },
                  { label: 'Database', value: 'PostgreSQL Cloud' },
                  { label: 'Frontend', value: 'React 19 + TypeScript + Vite' },
                  { label: 'Dikembangkan oleh', value: `${user?.business_name || 'Sentosa Retail'} IT Dept.` },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm py-2 border-b border-slate-800 last:border-0">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-slate-200 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-800/40 border border-slate-700 rounded-xl text-xs text-slate-400">
                © 2026 {user?.business_name || 'Sentosa Retail Group'}. Seluruh data transaksi dilindungi dan dienkripsi.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
