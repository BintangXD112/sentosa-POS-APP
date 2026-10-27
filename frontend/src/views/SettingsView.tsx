import React, { useState, useEffect } from 'react';
import {
  User,
  Users,
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
  Plus,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore, type AccentColor } from '../store/themeStore';
import { apiRequest } from '../api/client';
import type { Branch, Role } from '../types';

const roleLabels: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  branch_manager: { label: 'Branch Manager', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  cashier: { label: 'Kasir', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  inventory_staff: { label: 'Staf Gudang', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

type Section = 'profile' | 'store' | 'users' | 'security' | 'notifications' | 'appearance' | 'about';

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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [branchesList, setBranchesList] = useState<Branch[]>([]);

  // Branch editing state
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchData, setNewBranchData] = useState({
    name: '',
    address: '',
    phone: '',
    is_active: true,
  });
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
          two_factor_enabled: boolean;
        };
        branches: Branch[];
      }>('/business');

      if (data.business) {
        setBizName(data.business.name || '');
        setBizCurrency(data.business.currency || 'IDR');
        setBizPhone(data.business.phone || '');
        setBizAddress(data.business.address || '');
        setBizReceiptFooter(data.business.receipt_footer || '');
        setTwoFactorEnabled(data.business.two_factor_enabled !== false);
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

  // --- User Management state (Owner only) ---
  interface ManagedUser {
    id: string;
    username: string;
    email: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    created_at: string;
    branches: Branch[];
  }

  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<ManagedUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // User form fields
  const [uUsername, setUUsername] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<Role>('cashier');
  const [uIsActive, setUIsActive] = useState(true);
  const [uBranchIds, setUBranchIds] = useState<string[]>([]);

  const handleToggleTwoFactor = async () => {
    if (!isOwner || twoFactorSaving) return;
    const nextValue = !twoFactorEnabled;
    setTwoFactorSaving(true);
    setTwoFactorMessage(null);
    try {
      await apiRequest('/business/two-factor', {
        method: 'PUT',
        body: JSON.stringify({ enabled: nextValue }),
      });
      setTwoFactorEnabled(nextValue);
      setTwoFactorMessage({
        type: 'success',
        text: nextValue ? 'A2F OTP berhasil diaktifkan.' : 'A2F OTP berhasil dinonaktifkan.',
      });
    } catch (err: any) {
      setTwoFactorMessage({ type: 'error', text: err?.message || 'Gagal menyimpan pengaturan A2F.' });
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const fetchUsers = async () => {
    if (!isOwner) return;
    setUsersLoading(true);
    try {
      const res = await apiRequest<{ users: ManagedUser[] }>('/users');
      setUsersList(res.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if ((activeSection === 'store' || activeSection === 'users') && isOwner) {
      fetchBusinessData();
      if (activeSection === 'users') {
        fetchUsers();
      }
    }
  }, [activeSection, isOwner]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUUsername('');
    setUFullName('');
    setUEmail('');
    setUPassword('');
    setURole('cashier');
    setUIsActive(true);
    setUBranchIds(branchesList.map((b) => b.id));
    setUserMsg(null);
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (u: ManagedUser) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUFullName(u.full_name);
    setUEmail(u.email);
    setUPassword('');
    setURole(u.role);
    setUIsActive(u.is_active);
    setUBranchIds(u.branches ? u.branches.map((b) => b.id) : []);
    setUserMsg(null);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserMsg(null);

    if (!uFullName.trim()) {
      setUserMsg({ type: 'error', text: 'Nama lengkap wajib diisi.' });
      return;
    }
    if (!editingUser && !uUsername.trim()) {
      setUserMsg({ type: 'error', text: 'Username wajib diisi.' });
      return;
    }
    if (!editingUser && (!uPassword || uPassword.length < 6)) {
      setUserMsg({ type: 'error', text: 'Password minimal 6 karakter.' });
      return;
    }

    setUserSaving(true);
    try {
      if (editingUser) {
        await apiRequest(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: uFullName.trim(),
            email: uEmail.trim(),
            role: uRole,
            password: uPassword || undefined,
            is_active: uIsActive,
            branch_ids: uBranchIds,
          }),
        });
        setUserMsg({ type: 'success', text: 'Data pengguna berhasil diperbarui!' });
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: uUsername.trim().toLowerCase(),
            full_name: uFullName.trim(),
            email: uEmail.trim(),
            password: uPassword,
            role: uRole,
            branch_ids: uBranchIds,
          }),
        });
        setUserMsg({ type: 'success', text: 'Pengguna baru berhasil ditambahkan!' });
      }

      fetchUsers();
      setTimeout(() => {
        setUserModalOpen(false);
        setUserMsg(null);
      }, 1000);
    } catch (err: any) {
      setUserMsg({ type: 'error', text: err.message || 'Gagal menyimpan data pengguna.' });
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (u: ManagedUser) => {
    if (u.id === user?.id) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await apiRequest<{ message: string }>(`/users/${u.id}`, {
        method: 'DELETE',
      });
      alert(res.message || 'Pengguna berhasil dihapus');
      setDeleteConfirmUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pengguna.');
    } finally {
      setDeleteLoading(false);
    }
  };

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

  const currentRole = user ? (roleLabels[user.role] ?? { label: 'Staff', color: 'bg-white/[0.08] text-slate-300' }) : null;

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

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchMessage(null);

    if (!newBranchData.name.trim()) {
      setBranchMessage({ type: 'error', text: 'Nama cabang tidak boleh kosong.' });
      return;
    }

    setBranchSaving(true);
    try {
      const res = await apiRequest<{ message: string; branch: Branch }>('/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: newBranchData.name.trim(),
          address: newBranchData.address.trim(),
          phone: newBranchData.phone.trim(),
          is_active: newBranchData.is_active,
        }),
      });

      const newBranch = res.branch;
      setBranchesList((prev) => [...prev, newBranch]);

      // Update auth store user branches so header switcher has it immediately
      if (user) {
        const updatedBranches = [...(user.branches || []), newBranch];
        updateUser({ ...user, branches: updatedBranches });
      }

      // If no branch was active, set it to the new branch
      if (!currentBranch) {
        setCurrentBranch(newBranch);
      }

      setBranchMessage({ type: 'success', text: res.message || 'Cabang baru berhasil ditambahkan!' });
      setNewBranchData({ name: '', address: '', phone: '', is_active: true });
      setTimeout(() => {
        setIsAddingBranch(false);
        setBranchMessage(null);
      }, 1200);
    } catch (err: any) {
      setBranchMessage({ type: 'error', text: err.message || 'Gagal menambahkan cabang.' });
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
          {
            id: 'users' as Section,
            label: 'Manajemen Pengguna',
            icon: <Users className="w-4 h-4" />,
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
                : 'bg-[#0e1520] border border-white/[0.08] text-slate-400 hover:text-slate-200'
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
          <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl overflow-hidden sticky top-6">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-white/[0.08] last:border-0 ${
                  activeSection === s.id
                    ? 'bg-emerald-600/10 text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
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
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
              <div className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-xl border border-white/[0.08]">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-emerald-500/20 flex-shrink-0">
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
                      className="w-full px-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
                        className="w-full pl-8 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
                      className="w-full px-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Peran / Hak Akses
                    </label>
                    <div className="px-3.5 py-2.5 bg-[#090d14]/60 border border-white/[0.06] rounded-xl text-sm text-slate-400 flex items-center justify-between">
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
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
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
              <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
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
                            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-medium"
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
                            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
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
                            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
                            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
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
                            className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
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
              <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span>Daftar Cabang / Outlet Toko</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kelola nama, alamat, dan nomor telepon setiap cabang yang terdaftar
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">Total: {branchesList.length} Cabang</span>
                    {!isAddingBranch && !editingBranch && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingBranch(true);
                          setEditingBranch(null);
                          setBranchMessage(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Cabang</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Tambah Cabang Baru */}
                {isAddingBranch && (
                  <form
                    onSubmit={handleCreateBranch}
                    className="bg-[#0e1520] border border-emerald-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Cabang Baru</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingBranch(false);
                          setBranchMessage(null);
                        }}
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
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Nama Cabang <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Cabang Sentosa Mall"
                          value={newBranchData.name}
                          onChange={(e) => setNewBranchData({ ...newBranchData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Telepon Cabang</label>
                        <input
                          type="text"
                          placeholder="Contoh: 0812-3456-7890"
                          value={newBranchData.phone}
                          onChange={(e) => setNewBranchData({ ...newBranchData, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Alamat Cabang</label>
                        <input
                          type="text"
                          placeholder="Contoh: Jl. Sudirman No. 12, Jakarta Pusat"
                          value={newBranchData.address}
                          onChange={(e) => setNewBranchData({ ...newBranchData, address: e.target.value })}
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <input
                          id="new-branch-active-check"
                          type="checkbox"
                          checked={newBranchData.is_active}
                          onChange={(e) => setNewBranchData({ ...newBranchData, is_active: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 bg-[#090d14] border-white/[0.08] focus:ring-emerald-500"
                        />
                        <label htmlFor="new-branch-active-check" className="text-xs text-slate-300 cursor-pointer">
                          Cabang langsung aktif beroperasi
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={branchSaving}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        {branchSaving ? 'Menyimpan...' : 'Simpan Cabang Baru'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingBranch(false);
                          setBranchMessage(null);
                        }}
                        className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                )}

                {editingBranch && (
                  <form
                    onSubmit={handleSaveBranch}
                    className="bg-[#0e1520] border border-emerald-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
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
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Telepon Cabang</label>
                        <input
                          type="text"
                          value={editingBranch.phone}
                          onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Alamat Cabang</label>
                        <input
                          type="text"
                          value={editingBranch.address}
                          onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                          className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <input
                          id="branch-active-check"
                          type="checkbox"
                          checked={editingBranch.is_active}
                          onChange={(e) => setEditingBranch({ ...editingBranch, is_active: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 bg-[#090d14] border-white/[0.08] focus:ring-emerald-500"
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
                        className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-xs rounded-lg"
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
                      className="flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.08] rounded-xl transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{branch.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              branch.is_active
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/[0.08] text-slate-400'
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
                          setIsAddingBranch(false);
                          setBranchMessage(null);
                        }}
                        className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
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

          {/* USER MANAGEMENT SECTION (OWNER ONLY) */}
          {activeSection === 'users' && isOwner && (
            <div className="space-y-6">
              <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <span>Manajemen Pengguna & Staf</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tambah, edit, ganti peran hak akses, dan kelola penugasan cabang kasir
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddUser}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Pengguna</span>
                  </button>
                </div>

                {/* Filter and stats */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Cari pengguna (nama, username, email)..."
                      className="w-full pl-10 pr-3.5 py-2 bg-[#090d14] border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    Total: <strong className="text-slate-200">{usersList.length} Akun</strong>
                  </div>
                </div>

                {/* User Cards / Table */}
                {usersLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Memuat data pengguna...</div>
                ) : usersList.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">Belum ada pengguna terdaftar.</div>
                ) : (
                  <div className="space-y-2.5">
                    {usersList
                      .filter((u) => {
                        const q = userSearch.toLowerCase();
                        return (
                          u.full_name.toLowerCase().includes(q) ||
                          u.username.toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q) ||
                          u.role.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const rBadge = roleLabels[u.role] || { label: u.role, color: 'bg-white/[0.08] text-slate-300' };
                        const isSelf = u.id === user?.id;

                        return (
                          <div
                            key={u.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.08]/80 rounded-xl gap-3 transition-colors"
                          >
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 border border-white/[0.08]">
                                {u.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-white truncate">{u.full_name}</span>
                                  <span className="text-xs text-slate-400 font-mono">@{u.username}</span>
                                  {isSelf && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-semibold">
                                      Akun Anda
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-full ${rBadge.color}`}>
                                    {rBadge.label}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      u.is_active
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    }`}
                                  >
                                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                                  {u.email && <span>{u.email}</span>}
                                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <Building2 className="w-3 h-3 text-emerald-400" />
                                    <span>
                                      {u.branches && u.branches.length > 0
                                        ? u.branches.map((b) => b.name).join(', ')
                                        : 'Belum ada cabang'}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-white/[0.08] transition-colors cursor-pointer"
                                title="Edit Pengguna"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Edit</span>
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => setDeleteConfirmUser(u)}
                                  className="px-2.5 py-1.5 bg-white/[0.04] hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-white/[0.08] transition-colors cursor-pointer"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Hapus</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Add / Edit User Modal */}
              {userModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                  <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-sm sm:text-base font-bold text-white">
                          {editingUser ? `Edit Pengguna: @${editingUser.username}` : 'Tambah Pengguna Baru'}
                        </h3>
                      </div>
                      <button
                        onClick={() => setUserModalOpen(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                      {userMsg && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                            userMsg.type === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{userMsg.text}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Nama Lengkap <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={uFullName}
                            onChange={(e) => setUFullName(e.target.value)}
                            placeholder="Contoh: Budi Santoso"
                            className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Username <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            disabled={!!editingUser}
                            value={uUsername}
                            onChange={(e) => setUUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                            placeholder="username_kasir"
                            className="w-full px-3 py-2 bg-[#090d14] disabled:bg-[#090d14] border border-white/[0.08] disabled:border-white/[0.08] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={uEmail}
                            onChange={(e) => setUEmail(e.target.value)}
                            placeholder="user@toko.com"
                            className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Peran (Role) <span className="text-rose-400">*</span>
                          </label>
                          <select
                            value={uRole}
                            onChange={(e) => setURole(e.target.value as Role)}
                            className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="cashier">Kasir (POS & Transaksi)</option>
                            <option value="branch_manager">Branch Manager (Cabang & Laporan)</option>
                            <option value="inventory_staff">Staf Gudang (Inventaris & Stok)</option>
                            <option value="owner">Owner (Akses Penuh Seluruh Cabang)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            {editingUser ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password Masuk *'}
                          </label>
                          <input
                            type="password"
                            required={!editingUser}
                            value={uPassword}
                            onChange={(e) => setUPassword(e.target.value)}
                            placeholder={editingUser ? 'Minimal 6 karakter' : 'Minimal 6 karakter'}
                            className="w-full px-3 py-2 bg-[#090d14] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-2">
                            Penugasan Cabang Toko
                          </label>
                          {branchesList.length === 0 ? (
                            <div className="text-xs text-slate-500 italic">Belum ada cabang terdaftar.</div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/[0.03] p-3 rounded-xl border border-white/[0.08]/60">
                              {branchesList.map((b) => (
                                <label key={b.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={uBranchIds.includes(b.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setUBranchIds([...uBranchIds, b.id]);
                                      } else {
                                        setUBranchIds(uBranchIds.filter((id) => id !== b.id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-emerald-600 bg-[#090d14] border-white/[0.08] focus:ring-emerald-500"
                                  />
                                  <span>{b.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        {editingUser && (
                          <div className="sm:col-span-2 flex items-center gap-2">
                            <input
                              id="user-active-toggle"
                              type="checkbox"
                              checked={uIsActive}
                              onChange={(e) => setUIsActive(e.target.checked)}
                              className="w-4 h-4 rounded text-emerald-600 bg-[#090d14] border-white/[0.08] focus:ring-emerald-500"
                            />
                            <label htmlFor="user-active-toggle" className="text-xs text-slate-300 cursor-pointer">
                              Akun ini aktif (dapat login ke sistem POS)
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 flex justify-end gap-2 border-t border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => setUserModalOpen(false)}
                          className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.06] text-xs font-semibold"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={userSaving}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
                        >
                          {userSaving ? 'Menyimpan...' : 'Simpan Pengguna'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {deleteConfirmUser && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                  <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
                    <div className="flex items-center gap-3 text-rose-400">
                      <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Konfirmasi Hapus Akun</h3>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Apakah Anda yakin ingin menghapus pengguna <strong className="text-white">{deleteConfirmUser.full_name}</strong> (@{deleteConfirmUser.username})?
                      <br /><br />
                      <span className="text-slate-400">
                        Jika pengguna memiliki catatan penjualan atau mutasi inventaris, sistem akan otomatis menonaktifkan akun untuk menjaga audit transaksi.
                      </span>
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => setDeleteConfirmUser(null)}
                        className="px-3.5 py-2 rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.06] text-xs font-semibold"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleDeleteUser(deleteConfirmUser)}
                        disabled={deleteLoading}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 transition-all"
                      >
                        {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECURITY SECTION */}
          {activeSection === 'security' && (
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
              {isOwner && (
                <div className="pb-5 border-b border-white/[0.08]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-bold text-white">Autentikasi Dua Faktor (A2F)</h2>
                      <p className="text-xs text-slate-400 mt-1 max-w-xl">
                        Atur apakah semua pengguna di toko ini wajib memasukkan OTP email saat login dari perangkat baru.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={twoFactorEnabled}
                      aria-label="Aktifkan autentikasi dua faktor"
                      onClick={handleToggleTwoFactor}
                      disabled={twoFactorSaving}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${twoFactorEnabled ? 'bg-emerald-600' : 'bg-white/[0.08]'}`}
                    >
                      <span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-transform ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <Shield className={twoFactorEnabled ? 'w-4 h-4 text-emerald-400' : 'w-4 h-4 text-slate-500'} />
                    <span className={twoFactorEnabled ? 'text-emerald-300' : 'text-slate-400'}>
                      {twoFactorEnabled ? 'Aktif — OTP diperlukan untuk perangkat baru.' : 'Nonaktif — login tidak meminta OTP.'}
                    </span>
                  </div>
                  {twoFactorMessage && (
                    <div className={`mt-3 text-xs ${twoFactorMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {twoFactorMessage.text}
                    </div>
                  )}
                </div>
              )}

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
                      className="w-full pl-10 pr-11 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
                      className="w-full pl-10 pr-11 py-2.5 bg-[#090d14] border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
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
                              i <= passStrength ? passStrengthColor : 'bg-white/[0.08]'
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
                    className={`w-full px-3.5 py-2.5 bg-[#090d14] border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                      confirmPass && newPass !== confirmPass
                        ? 'border-rose-500'
                        : confirmPass && newPass === confirmPass
                        ? 'border-emerald-500'
                        : 'border-white/[0.08] focus:border-emerald-500'
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
              <div className="pt-4 border-t border-white/[0.08]">
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
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
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
                    className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      onClick={() => item.set(!item.value)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        item.value ? 'bg-emerald-600' : 'bg-white/[0.08]'
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
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
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
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#090d14] scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Mode Kompak</div>
                  <div className="text-xs text-slate-400 mt-0.5">Kurangi spasi untuk menampilkan lebih banyak konten</div>
                </div>
                <button
                  onClick={() => setCompactMode(!compactMode)}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    compactMode ? 'bg-emerald-600' : 'bg-white/[0.08]'
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
            <div className="bg-[#0e1520] border border-white/[0.08] rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
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
                  <div key={item.label} className="flex justify-between text-sm py-2 border-b border-white/[0.08] last:border-0">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-slate-200 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-slate-400">
                © 2026 {user?.business_name || 'Sentosa Retail Group'}. Seluruh data transaksi dilindungi dan dienkripsi.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
